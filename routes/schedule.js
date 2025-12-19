/**
 * Schedule Management Routes
 * 
 * Endpoints for managing video schedules and timeline items
 * Schedules can be viewed publicly via unique 5-character code
 */

const express = require('express');
const router = express.Router();
const { body, validationResult, param } = require('express-validator');
const { Schedule, ScheduleItem, Video, User, Company, Device, sequelize, Sequelize } = require('../models');
const { verifyToken, requireRole } = require('../middleware/jwtAuth');
const { generateUniqueCode, isValidCode } = require('../utils/scheduleCode');

/**
 * Helper function to validate UUID format
 */
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * Helper function to convert time string (HH:MM:SS) to seconds
 */
const timeToSeconds = (timeStr) => {
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);
  return hours * 3600 + minutes * 60 + (seconds || 0);
};

/**
 * Helper function to check if two day-of-week arrays overlap
 * Returns true if they share common days or if either is null (every day)
 */
const daysOverlap = (days1, days2) => {
  // If either is null, it means "every day", so they overlap
  if (!days1 || !days2) return true;
  
  // Check if arrays share any common day
  return days1.some(day => days2.includes(day));
};

/**
 * Helper function to check if date ranges overlap
 */
const dateRangesOverlap = (start1, end1, start2, end2) => {
  // If no date ranges specified, they overlap
  if (!start1 && !end1 && !start2 && !end2) return true;
  
  // Convert to dates for comparison
  const s1 = start1 ? new Date(start1) : null;
  const e1 = end1 ? new Date(end1) : null;
  const s2 = start2 ? new Date(start2) : null;
  const e2 = end2 ? new Date(end2) : null;
  
  // If one has no date range, assume it overlaps
  if (!s1 && !e1) return true;
  if (!s2 && !e2) return true;
  
  // Check if date ranges overlap
  // Range 1: [s1, e1], Range 2: [s2, e2]
  // They overlap if: s1 <= e2 AND s2 <= e1
  const start1Date = s1 || new Date('1900-01-01');
  const end1Date = e1 || new Date('2100-12-31');
  const start2Date = s2 || new Date('1900-01-01');
  const end2Date = e2 || new Date('2100-12-31');
  
  return start1Date <= end2Date && start2Date <= end1Date;
};

/**
 * Find and adjust overlapping schedule items
 * New items have PRIORITY - existing items are automatically adjusted or removed
 * @returns {Object} { adjustedItems, removedItems }
 */
const adjustOverlappingItems = async (scheduleId, startTime, duration, dayOfWeek, startDate, endDate, transaction, excludeItemId = null) => {
  const newStartSeconds = timeToSeconds(startTime);
  const newEndSeconds = newStartSeconds + duration;
  
  // Get all active items in the schedule
  const existingItems = await ScheduleItem.findAll({
    where: {
      scheduleId: scheduleId,
      isActive: true,
      ...(excludeItemId && { id: { [Sequelize.Op.ne]: excludeItemId } }),
    },
    include: [
      {
        model: Video,
        as: 'video',
        attributes: ['id', 'fileName'],
      },
    ],
    transaction,
  });
  
  const adjustedItems = [];
  const removedItems = [];
  
  for (const item of existingItems) {
    const itemStartSeconds = timeToSeconds(item.startTime);
    const itemEndSeconds = itemStartSeconds + item.duration;
    
    // Check if time ranges overlap
    const timeOverlaps = newStartSeconds < itemEndSeconds && itemStartSeconds < newEndSeconds;
    if (!timeOverlaps) continue;
    
    // Check if days overlap
    const daysOverlapFlag = daysOverlap(dayOfWeek, item.dayOfWeek);
    if (!daysOverlapFlag) continue;
    
    // Check if date ranges overlap
    const datesOverlapFlag = dateRangesOverlap(startDate, endDate, item.startDate, item.endDate);
    if (!datesOverlapFlag) continue;
    
    // Overlap detected - determine how to adjust (NEW VIDEO HAS PRIORITY)
    
    // Case 1: New item completely covers existing item -> Remove existing
    if (newStartSeconds <= itemStartSeconds && newEndSeconds >= itemEndSeconds) {
      await item.update({ isActive: false }, { transaction });
      removedItems.push({
        id: item.id,
        videoName: item.video.fileName,
        reason: 'Completely overlapped by new video',
      });
      continue;
    }
    
    // Case 2: New item starts before and overlaps beginning -> Trim existing item start
    if (newStartSeconds <= itemStartSeconds && newEndSeconds < itemEndSeconds) {
      const newItemStart = newEndSeconds; // Start after new video ends
      const newItemDuration = itemEndSeconds - newEndSeconds;
      const newStartTime = new Date(newItemStart * 1000).toISOString().substr(11, 8);
      
      await item.update({
        startTime: newStartTime,
        duration: newItemDuration,
      }, { transaction });
      
      adjustedItems.push({
        id: item.id,
        videoName: item.video.fileName,
        oldStart: item.startTime,
        oldDuration: item.duration,
        newStart: newStartTime,
        newDuration: newItemDuration,
        adjustment: 'Start time moved forward',
      });
      continue;
    }
    
    // Case 3: New item starts after and overlaps end -> Trim existing item end
    if (newStartSeconds > itemStartSeconds && newEndSeconds >= itemEndSeconds) {
      const newItemDuration = newStartSeconds - itemStartSeconds;
      
      await item.update({
        duration: newItemDuration,
      }, { transaction });
      
      adjustedItems.push({
        id: item.id,
        videoName: item.video.fileName,
        oldStart: item.startTime,
        oldDuration: item.duration,
        newStart: item.startTime,
        newDuration: newItemDuration,
        adjustment: 'Duration shortened',
      });
      continue;
    }
    
    // Case 4: New item is in the middle -> Split existing item (keep first part, remove second)
    if (newStartSeconds > itemStartSeconds && newEndSeconds < itemEndSeconds) {
      // Keep the part before the new item, discard the part after
      const newItemDuration = newStartSeconds - itemStartSeconds;
      
      await item.update({
        duration: newItemDuration,
      }, { transaction });
      
      adjustedItems.push({
        id: item.id,
        videoName: item.video.fileName,
        oldStart: item.startTime,
        oldDuration: item.duration,
        newStart: item.startTime,
        newDuration: newItemDuration,
        adjustment: 'Duration shortened (middle overlap - new video takes priority)',
      });
      // Note: We don't create the second part - new video takes complete priority
    }
  }
  
  return {
    adjustedItems,
    removedItems,
  };
};

/**
 * POST /api/schedules
 * Create a new schedule
 * Requires: accessToken
 * Allowed roles: owner, admin, manager, member
 */
router.post('/',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Schedule name is required')
      .isLength({ max: 255 })
      .withMessage('Schedule name must be less than 255 characters'),
    body('description')
      .optional()
      .trim(),
    body('timezone')
      .optional()
      .isString()
      .withMessage('Timezone must be a string'),
    body('settings')
      .optional()
      .isObject()
      .withMessage('Settings must be an object'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { name, description, timezone, settings } = req.body;

      // Generate unique code
      const code = await generateUniqueCode(Schedule);

      // Create schedule
      const schedule = await Schedule.create({
        companyId: req.company.id,
        createdBy: req.user.id,
        name,
        description: description || null,
        code,
        timezone: timezone || 'UTC',
        settings: settings || {},
        isActive: true,
      });

      res.status(201).json({
        success: true,
        message: 'Schedule created successfully',
        data: {
          id: schedule.id,
          name: schedule.name,
          description: schedule.description,
          code: schedule.code,
          timezone: schedule.timezone,
          settings: schedule.settings,
          isActive: schedule.isActive,
          createdAt: schedule.createdAt,
        },
      });
    } catch (error) {
      console.error('Create schedule error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while creating the schedule',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/schedules
 * List all schedules for the current company
 * Requires: accessToken
 * Allowed roles: All authenticated users
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const schedules = await Schedule.findAll({
      where: {
        companyId: req.company.id,
        isActive: true,
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
        {
          model: ScheduleItem,
          as: 'items',
          where: { isActive: true },
          required: false,
          include: [
            {
              model: Video,
              as: 'video',
              attributes: ['id', 'fileName', 'fileSize', 'mimeType', 'duration'],
            },
          ],
        },
      ],
      order: [
        ['createdAt', 'DESC'],
        [{ model: ScheduleItem, as: 'items' }, 'startTime', 'ASC'],
      ],
    });

    const formattedSchedules = schedules.map(schedule => ({
      id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      code: schedule.code,
      timezone: schedule.timezone,
      settings: schedule.settings,
      isActive: schedule.isActive,
      itemCount: schedule.items ? schedule.items.length : 0,
      creator: {
        id: schedule.creator.id,
        email: schedule.creator.email,
        name: `${schedule.creator.firstName} ${schedule.creator.lastName}`,
      },
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    }));

    res.json({
      success: true,
      data: {
        schedules: formattedSchedules,
        count: formattedSchedules.length,
      },
    });
  } catch (error) {
    console.error('List schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching schedules',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/schedules/:scheduleId
 * Get details of a specific schedule
 * Requires: accessToken
 * Allowed roles: All authenticated users
 */
router.get('/:scheduleId', verifyToken, async (req, res) => {
  try {
    const { scheduleId } = req.params;

    if (!isValidUUID(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schedule ID format',
      });
    }

    const schedule = await Schedule.findOne({
      where: {
        id: scheduleId,
        companyId: req.company.id,
        isActive: true,
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        },
        {
          model: ScheduleItem,
          as: 'items',
          where: { isActive: true },
          required: false,
          include: [
            {
              model: Video,
              as: 'video',
              attributes: ['id', 'fileName', 'originalFileName', 'fileSize', 'mimeType', 'duration', 'resolution'],
            },
          ],
          order: [['startTime', 'ASC']],
        },
      ],
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found',
      });
    }

    // Get device count
    const deviceCount = await Device.count({
      where: {
        scheduleId: schedule.id,
        isActive: true,
      },
    });

    res.json({
      success: true,
      data: {
        id: schedule.id,
        name: schedule.name,
        description: schedule.description,
        code: schedule.code,
        timezone: schedule.timezone,
        settings: schedule.settings,
        isActive: schedule.isActive,
        deviceCount: deviceCount,
        creator: {
          id: schedule.creator.id,
          email: schedule.creator.email,
          name: `${schedule.creator.firstName} ${schedule.creator.lastName}`,
        },
        items: schedule.items ? schedule.items.map(item => ({
          id: item.id,
          startTime: item.startTime,
          duration: item.duration,
          dayOfWeek: item.dayOfWeek,
          startDate: item.startDate,
          endDate: item.endDate,
          order: item.order,
          metadata: item.metadata,
          video: item.video,
          createdAt: item.createdAt,
        })) : [],
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/schedules/public/:code
 * Get schedule by public code (NO AUTHENTICATION REQUIRED)
 * Anyone with the code can view the schedule
 */
router.get('/public/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // Validate code format
    if (!isValidCode(code)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schedule code format',
      });
    }

    const schedule = await Schedule.findOne({
      where: {
        code: code,
        isActive: true,
      },
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name', 'logo'],
        },
        {
          model: ScheduleItem,
          as: 'items',
          where: { isActive: true },
          required: false,
          include: [
            {
              model: Video,
              as: 'video',
              where: { isActive: true },
              attributes: ['id', 'fileName', 'fileSize', 'mimeType', 'duration', 'resolution'],
            },
          ],
          order: [['startTime', 'ASC']],
        },
      ],
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found or inactive',
      });
    }

    // Get device count
    const deviceCount = await Device.count({
      where: {
        scheduleId: schedule.id,
        isActive: true,
      },
    });

    res.json({
      success: true,
      data: {
        id: schedule.id,
        name: schedule.name,
        description: schedule.description,
        code: schedule.code,
        timezone: schedule.timezone,
        settings: schedule.settings,
        deviceCount: deviceCount,
        company: {
          name: schedule.company.name,
          logo: schedule.company.logo,
        },
        items: schedule.items ? schedule.items.map(item => ({
          id: item.id,
          startTime: item.startTime,
          duration: item.duration,
          dayOfWeek: item.dayOfWeek,
          startDate: item.startDate,
          endDate: item.endDate,
          order: item.order,
          metadata: item.metadata,
          video: item.video,
        })) : [],
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get public schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/schedules/device/register
 * Register a device to a schedule using the schedule code
 * PUBLIC ENDPOINT - No authentication required
 * Creates or updates device registration and returns schedule details
 */
router.post('/device/register',
  [
    body('scheduleCode')
      .trim()
      .notEmpty()
      .withMessage('Schedule code is required')
      .isLength({ min: 5, max: 5 })
      .withMessage('Schedule code must be exactly 5 characters'),
    body('uid')
      .trim()
      .notEmpty()
      .withMessage('Device UID is required'),
    body('deviceInfo')
      .optional()
      .isObject()
      .withMessage('Device info must be an object'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { scheduleCode, uid, deviceInfo } = req.body;

      // Validate code format
      if (!isValidCode(scheduleCode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid schedule code format',
        });
      }

      // Find schedule by code
      const schedule = await Schedule.findOne({
        where: {
          code: scheduleCode,
          isActive: true,
        },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name', 'logo'],
          },
          {
            model: ScheduleItem,
            as: 'items',
            where: { isActive: true },
            required: false,
            include: [
              {
                model: Video,
                as: 'video',
                where: { isActive: true },
                attributes: ['id', 'fileName', 'fileSize', 'mimeType', 'duration', 'resolution'],
              },
            ],
            order: [['startTime', 'ASC']],
          },
        ],
      });

      if (!schedule) {
        return res.status(404).json({
          success: false,
          message: 'Schedule not found or inactive',
        });
      }

      // Create or update device registration
      const [device, created] = await Device.findOrCreate({
        where: {
          scheduleId: schedule.id,
          uid: uid,
        },
        defaults: {
          scheduleId: schedule.id,
          uid: uid,
          deviceInfo: deviceInfo || {},
          lastSeen: new Date(),
          isActive: true,
        },
      });

      // If device already exists, update it
      if (!created) {
        await device.update({
          deviceInfo: deviceInfo || device.deviceInfo,
          lastSeen: new Date(),
          isActive: true,
        });
      }

      res.status(created ? 201 : 200).json({
        success: true,
        message: created 
          ? 'Device registered successfully'
          : 'Device updated successfully',
        device: {
          id: device.id,
          uid: device.uid,
          lastSeen: device.lastSeen,
          registered: created,
        },
        schedule: {
          id: schedule.id,
          name: schedule.name,
          description: schedule.description,
          code: schedule.code,
          timezone: schedule.timezone,
          settings: schedule.settings,
          company: {
            name: schedule.company.name,
            logo: schedule.company.logo,
          },
          items: schedule.items ? schedule.items.map(item => ({
            id: item.id,
            startTime: item.startTime,
            duration: item.duration,
            dayOfWeek: item.dayOfWeek,
            startDate: item.startDate,
            endDate: item.endDate,
            order: item.order,
            metadata: item.metadata,
            video: item.video,
          })) : [],
          createdAt: schedule.createdAt,
          updatedAt: schedule.updatedAt,
        },
      });
    } catch (error) {
      console.error('Device registration error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while registering the device',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * PUT /api/schedules/:scheduleId
 * Update schedule details
 * Requires: accessToken
 * Allowed roles: owner, admin, manager, member (creator only for members)
 */
router.put('/:scheduleId',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Schedule name cannot be empty'),
    body('description')
      .optional()
      .trim(),
    body('timezone')
      .optional()
      .isString()
      .withMessage('Timezone must be a string'),
    body('settings')
      .optional()
      .isObject()
      .withMessage('Settings must be an object'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { scheduleId } = req.params;
      const { name, description, timezone, settings, isActive } = req.body;

      if (!isValidUUID(scheduleId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid schedule ID format',
        });
      }

      const schedule = await Schedule.findOne({
        where: {
          id: scheduleId,
          companyId: req.company.id,
          isActive: true,
        },
      });

      if (!schedule) {
        return res.status(404).json({
          success: false,
          message: 'Schedule not found',
        });
      }

      // Check permissions: members can only edit their own schedules
      const canUpdate = 
        schedule.createdBy === req.user.id ||
        ['owner', 'admin', 'manager'].includes(req.userCompany.role);

      if (!canUpdate) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this schedule',
        });
      }

      // Update schedule
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (timezone !== undefined) updateData.timezone = timezone;
      if (settings !== undefined) updateData.settings = settings;
      if (isActive !== undefined) updateData.isActive = isActive;

      await schedule.update(updateData);

      res.json({
        success: true,
        message: 'Schedule updated successfully',
        data: {
          id: schedule.id,
          name: schedule.name,
          description: schedule.description,
          code: schedule.code,
          timezone: schedule.timezone,
          settings: schedule.settings,
          isActive: schedule.isActive,
          updatedAt: schedule.updatedAt,
        },
      });
    } catch (error) {
      console.error('Update schedule error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while updating the schedule',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * DELETE /api/schedules/:scheduleId
 * Delete a schedule (soft delete)
 * Requires: accessToken
 * Allowed roles: owner, admin, manager (or creator if member)
 */
router.delete('/:scheduleId',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  async (req, res) => {
    try {
      const { scheduleId } = req.params;

      if (!isValidUUID(scheduleId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid schedule ID format',
        });
      }

      const schedule = await Schedule.findOne({
        where: {
          id: scheduleId,
          companyId: req.company.id,
          isActive: true,
        },
      });

      if (!schedule) {
        return res.status(404).json({
          success: false,
          message: 'Schedule not found',
        });
      }

      // Check permissions
      const canDelete = 
        schedule.createdBy === req.user.id ||
        ['owner', 'admin', 'manager'].includes(req.userCompany.role);

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this schedule',
        });
      }

      // Soft delete
      await schedule.update({ isActive: false });

      res.json({
        success: true,
        message: 'Schedule deleted successfully',
        data: {
          id: schedule.id,
          name: schedule.name,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Delete schedule error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the schedule',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/schedules/:scheduleId/items
 * Add a video item to schedule timeline
 * Requires: accessToken
 * Allowed roles: owner, admin, manager, member
 */
router.post('/:scheduleId/items',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  [
    body('videoId')
      .isUUID()
      .withMessage('Valid video ID is required'),
    body('startTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
      .withMessage('Start time must be in HH:MM or HH:MM:SS format'),
    body('duration')
      .isInt({ min: 1 })
      .withMessage('Duration must be a positive integer (seconds)'),
    body('dayOfWeek')
      .optional()
      .isArray()
      .withMessage('Day of week must be an array'),
    body('dayOfWeek.*')
      .optional()
      .isInt({ min: 0, max: 6 })
      .withMessage('Day of week values must be 0-6 (0=Sunday)'),
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid date'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid date'),
    body('order')
      .optional()
      .isInt()
      .withMessage('Order must be an integer'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object'),
  ],
  async (req, res) => {
    // Use transaction to ensure atomic operation
    const t = await sequelize.transaction();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { scheduleId } = req.params;
      const { videoId, startTime, duration, dayOfWeek, startDate, endDate, order, metadata } = req.body;

      if (!isValidUUID(scheduleId)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Invalid schedule ID format',
        });
      }

      // Check schedule exists and belongs to company
      const schedule = await Schedule.findOne({
        where: {
          id: scheduleId,
          companyId: req.company.id,
          isActive: true,
        },
        transaction: t,
      });

      if (!schedule) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: 'Schedule not found',
        });
      }

      // Check video exists and belongs to company
      const video = await Video.findOne({
        where: {
          id: videoId,
          companyId: req.company.id,
          isActive: true,
        },
        transaction: t,
      });

      if (!video) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: 'Video not found',
        });
      }

      // Normalize time to HH:MM:SS format
      let normalizedTime = startTime;
      if (startTime.split(':').length === 2) {
        normalizedTime = `${startTime}:00`;
      }

      // Adjust overlapping schedule items (new video has priority)
      const adjustmentResult = await adjustOverlappingItems(
        scheduleId,
        normalizedTime,
        duration,
        dayOfWeek || null,
        startDate || null,
        endDate || null,
        t // Pass transaction
      );

      // Create schedule item (within transaction)
      const scheduleItem = await ScheduleItem.create({
        scheduleId: schedule.id,
        videoId: video.id,
        startTime: normalizedTime,
        duration,
        dayOfWeek: dayOfWeek || null,
        startDate: startDate || null,
        endDate: endDate || null,
        order: order || 0,
        metadata: metadata || {},
        isActive: true,
      }, { transaction: t });

      // Fetch complete item with video details
      const completeItem = await ScheduleItem.findByPk(scheduleItem.id, {
        include: [
          {
            model: Video,
            as: 'video',
            attributes: ['id', 'fileName', 'fileSize', 'mimeType', 'duration'],
          },
        ],
        transaction: t,
      });

      // Commit transaction
      await t.commit();

      // Build response message
      let message = 'Schedule item added successfully';
      if (adjustmentResult.adjustedItems.length > 0 || adjustmentResult.removedItems.length > 0) {
        message += `. ${adjustmentResult.adjustedItems.length} existing video(s) adjusted, ${adjustmentResult.removedItems.length} video(s) removed to make room.`;
      }

      res.status(201).json({
        success: true,
        message: message,
        data: {
          id: completeItem.id,
          startTime: completeItem.startTime,
          duration: completeItem.duration,
          dayOfWeek: completeItem.dayOfWeek,
          startDate: completeItem.startDate,
          endDate: completeItem.endDate,
          order: completeItem.order,
          metadata: completeItem.metadata,
          video: completeItem.video,
          createdAt: completeItem.createdAt,
        },
        adjustments: {
          adjusted: adjustmentResult.adjustedItems,
          removed: adjustmentResult.removedItems,
        },
      });
    } catch (error) {
      // Rollback transaction on error
      await t.rollback();
      console.error('Add schedule item error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while adding the schedule item',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * PUT /api/schedules/:scheduleId/items/:itemId
 * Update a schedule item
 * Requires: accessToken
 * Allowed roles: owner, admin, manager, member
 */
router.put('/:scheduleId/items/:itemId',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  [
    body('videoId')
      .optional()
      .isUUID()
      .withMessage('Valid video ID is required'),
    body('startTime')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
      .withMessage('Start time must be in HH:MM or HH:MM:SS format'),
    body('duration')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Duration must be a positive integer (seconds)'),
    body('dayOfWeek')
      .optional()
      .isArray()
      .withMessage('Day of week must be an array'),
    body('startDate')
      .optional()
      .custom((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value))
      .withMessage('Start date must be null or a valid date (YYYY-MM-DD)'),
    body('endDate')
      .optional()
      .custom((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value))
      .withMessage('End date must be null or a valid date (YYYY-MM-DD)'),
    body('order')
      .optional()
      .isInt()
      .withMessage('Order must be an integer'),
    body('metadata')
      .optional()
      .isObject()
      .withMessage('Metadata must be an object'),
  ],
  async (req, res) => {
    // Use transaction to ensure atomic operation
    const t = await sequelize.transaction();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { scheduleId, itemId } = req.params;
      const { videoId, startTime, duration, dayOfWeek, startDate, endDate, order, metadata } = req.body;

      if (!isValidUUID(scheduleId) || !isValidUUID(itemId)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Invalid ID format',
        });
      }

      // Check schedule exists and belongs to company
      const schedule = await Schedule.findOne({
        where: {
          id: scheduleId,
          companyId: req.company.id,
          isActive: true,
        },
        transaction: t,
      });

      if (!schedule) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: 'Schedule not found',
        });
      }

      // Check schedule item exists
      const scheduleItem = await ScheduleItem.findOne({
        where: {
          id: itemId,
          scheduleId: scheduleId,
          isActive: true,
        },
        transaction: t,
      });

      if (!scheduleItem) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: 'Schedule item not found',
        });
      }

      // If videoId is being changed, verify it exists and belongs to company
      if (videoId) {
        const video = await Video.findOne({
          where: {
            id: videoId,
            companyId: req.company.id,
            isActive: true,
          },
          transaction: t,
        });

        if (!video) {
          await t.rollback();
          return res.status(404).json({
            success: false,
            message: 'Video not found',
          });
        }
      }

      // Prepare updated values (use existing if not provided)
      const updatedStartTime = startTime 
        ? (startTime.split(':').length === 2 ? `${startTime}:00` : startTime)
        : scheduleItem.startTime;
      const updatedDuration = duration !== undefined ? duration : scheduleItem.duration;
      const updatedDayOfWeek = dayOfWeek !== undefined ? dayOfWeek : scheduleItem.dayOfWeek;
      const updatedStartDate = startDate !== undefined ? startDate : scheduleItem.startDate;
      const updatedEndDate = endDate !== undefined ? endDate : scheduleItem.endDate;

      // Adjust overlapping schedule items (updated video has priority)
      const adjustmentResult = await adjustOverlappingItems(
        scheduleId,
        updatedStartTime,
        updatedDuration,
        updatedDayOfWeek,
        updatedStartDate,
        updatedEndDate,
        t, // Pass transaction
        itemId // Exclude this item from overlap check
      );

      // Update schedule item
      const updateData = {};
      if (videoId !== undefined) updateData.videoId = videoId;
      if (startTime !== undefined) updateData.startTime = updatedStartTime;
      if (duration !== undefined) updateData.duration = duration;
      if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
      if (startDate !== undefined) updateData.startDate = startDate;
      if (endDate !== undefined) updateData.endDate = endDate;
      if (order !== undefined) updateData.order = order;
      if (metadata !== undefined) updateData.metadata = metadata;

      await scheduleItem.update(updateData, { transaction: t });

      // Fetch updated item with video details
      const updatedItem = await ScheduleItem.findByPk(scheduleItem.id, {
        include: [
          {
            model: Video,
            as: 'video',
            attributes: ['id', 'fileName', 'fileSize', 'mimeType', 'duration'],
          },
        ],
        transaction: t,
      });

      // Commit transaction
      await t.commit();

      // Build response message
      let message = 'Schedule item updated successfully';
      if (adjustmentResult.adjustedItems.length > 0 || adjustmentResult.removedItems.length > 0) {
        message += `. ${adjustmentResult.adjustedItems.length} existing video(s) adjusted, ${adjustmentResult.removedItems.length} video(s) removed to make room.`;
      }

      res.json({
        success: true,
        message: message,
        data: {
          id: updatedItem.id,
          startTime: updatedItem.startTime,
          duration: updatedItem.duration,
          dayOfWeek: updatedItem.dayOfWeek,
          startDate: updatedItem.startDate,
          endDate: updatedItem.endDate,
          order: updatedItem.order,
          metadata: updatedItem.metadata,
          video: updatedItem.video,
          updatedAt: updatedItem.updatedAt,
        },
        adjustments: {
          adjusted: adjustmentResult.adjustedItems,
          removed: adjustmentResult.removedItems,
        },
      });
    } catch (error) {
      // Rollback transaction on error
      await t.rollback();
      console.error('Update schedule item error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while updating the schedule item',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * DELETE /api/schedules/:scheduleId/items/:itemId
 * Delete a schedule item (soft delete)
 * Requires: accessToken
 * Allowed roles: owner, admin, manager, member
 */
router.delete('/:scheduleId/items/:itemId',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  async (req, res) => {
    try {
      const { scheduleId, itemId } = req.params;

      if (!isValidUUID(scheduleId) || !isValidUUID(itemId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ID format',
        });
      }

      // Check schedule exists and belongs to company
      const schedule = await Schedule.findOne({
        where: {
          id: scheduleId,
          companyId: req.company.id,
          isActive: true,
        },
      });

      if (!schedule) {
        return res.status(404).json({
          success: false,
          message: 'Schedule not found',
        });
      }

      // Check schedule item exists
      const scheduleItem = await ScheduleItem.findOne({
        where: {
          id: itemId,
          scheduleId: scheduleId,
          isActive: true,
        },
      });

      if (!scheduleItem) {
        return res.status(404).json({
          success: false,
          message: 'Schedule item not found',
        });
      }

      // Soft delete
      await scheduleItem.update({ isActive: false });

      res.json({
        success: true,
        message: 'Schedule item deleted successfully',
        data: {
          id: scheduleItem.id,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Delete schedule item error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the schedule item',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

module.exports = router;

