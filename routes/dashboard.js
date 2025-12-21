const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Video, User, Company, UserCompany, ScheduleItem, Schedule } = require('../models');
const { webRequireAuth, webRequireCompany } = require('../middleware/sessionAuth');
const { ensureCompanyDir, deleteFile, isValidVideoMimeType } = require('../utils/fileStorage');
const { storageConfig } = require('../config');
const { generateUniqueCode } = require('../utils/scheduleCode');

/**
 * Configure multer for video uploads
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const companyDir = await ensureCompanyDir(req.company.id);
      cb(null, companyDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${safeName}_${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (isValidVideoMimeType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: storageConfig.maxFileSizeBytes,
  }
});

/**
 * GET /dashboard
 * Redirect to video library by default
 */
router.get('/', webRequireAuth, webRequireCompany, (req, res) => {
  res.redirect('/dashboard/videos');
});

/**
 * GET /dashboard/videos
 * Video library page
 */
router.get('/videos', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    // Load videos for the company
    const videos = await Video.findAll({
      where: {
        companyId: req.company.id,
        isActive: true,
      },
      include: [{
        model: User,
        as: 'uploader',
        attributes: ['id', 'email', 'firstName', 'lastName'],
      }],
      order: [['createdAt', 'DESC']],
    });

    // Format videos for display
    const formattedVideos = videos.map(video => ({
      id: video.id,
      fileName: video.fileName,
      originalFileName: video.originalFileName,
      fileSize: video.fileSize,
      mimeType: video.mimeType,
      duration: video.duration,
      resolution: video.resolution,
      uploadedAt: video.createdAt,
      uploader: {
        id: video.uploader.id,
        email: video.uploader.email,
        name: `${video.uploader.firstName} ${video.uploader.lastName}`,
      },
    }));

    res.render('videos', {
      user: req.user,
      company: req.company,
      userCompany: req.userCompany,
      videos: formattedVideos,
    });
  } catch (error) {
    console.error('Video library error:', error);
    res.status(500).send('Error loading video library');
  }
});

/**
 * GET /dashboard/schedules
 * Schedules page
 */
router.get('/schedules', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    // Fetch all schedules for the company
    const schedules = await Schedule.findAll({
      where: {
        companyId: req.company.id,
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: ScheduleItem,
          as: 'items',
          attributes: ['id'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.render('schedules', {
      user: req.user,
      company: req.company,
      userCompany: req.userCompany,
      schedules: schedules,
    });
  } catch (error) {
    console.error('Schedules error:', error);
    res.status(500).send('Error loading schedules');
  }
});

/**
 * POST /dashboard/schedules/create
 * Create a new schedule
 */
router.post('/schedules/create', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const { name, description, timezone, loop, autoStart } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.redirect('/dashboard/schedules?error=' + encodeURIComponent('Schedule name is required'));
    }

    // Build settings object
    const settings = {
      loop: loop === 'on' || loop === true,
      autoStart: autoStart === 'on' || autoStart === true
    };

    // Generate unique code
    const code = await generateUniqueCode(Schedule);

    // Create schedule in database
    const schedule = await Schedule.create({
      companyId: req.company.id,
      createdBy: req.user.id,
      name: name.trim(),
      description: description ? description.trim() : null,
      code: code,
      timezone: timezone || 'Asia/Kolkata',
      settings: settings,
      isActive: true
    });

    res.redirect('/dashboard/schedules?success=' + encodeURIComponent(`Schedule "${schedule.name}" created successfully! Code: ${schedule.code}`));
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.redirect('/dashboard/schedules?error=' + encodeURIComponent('Failed to create schedule: ' + error.message));
  }
});

/**
 * POST /dashboard/schedules/:scheduleId/delete
 * Delete a schedule
 */
router.post('/schedules/:scheduleId/delete', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const { scheduleId } = req.params;

    // Find the schedule
    const schedule = await Schedule.findOne({
      where: {
        id: scheduleId,
        companyId: req.company.id
      },
      include: [{
        model: ScheduleItem,
        as: 'items'
      }]
    });

    if (!schedule) {
      return res.redirect('/dashboard/schedules?error=' + encodeURIComponent('Schedule not found'));
    }

    // Check permissions - only creator, owner, admin, or manager can delete
    const isCreator = schedule.createdBy === req.user.id;
    const canDelete = isCreator || ['owner', 'admin', 'manager'].includes(req.userCompany.role);

    if (!canDelete) {
      return res.redirect('/dashboard/schedules?error=' + encodeURIComponent('You do not have permission to delete this schedule'));
    }

    const scheduleName = schedule.name;
    const itemCount = schedule.items ? schedule.items.length : 0;

    // Delete the schedule (cascade will delete schedule items)
    await schedule.destroy();

    res.redirect('/dashboard/schedules?success=' + encodeURIComponent(`Schedule "${scheduleName}" and its ${itemCount} video item(s) deleted successfully`));
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.redirect('/dashboard/schedules?error=' + encodeURIComponent('Failed to delete schedule: ' + error.message));
  }
});

/**
 * POST /dashboard/upload
 * Upload a new video
 */
router.post('/upload', webRequireAuth, webRequireCompany, (req, res, next) => {
  upload.single('video')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxSizeMB = (storageConfig.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
        return res.redirect(`/dashboard/videos?error=${encodeURIComponent(`File size too large. Maximum allowed size is ${maxSizeMB}MB`)}`);
      }
      return res.redirect(`/dashboard/videos?error=${encodeURIComponent('Upload error: ' + err.message)}`);
    } else if (err) {
      return res.redirect(`/dashboard/videos?error=${encodeURIComponent(err.message)}`);
    }

    if (!req.file) {
      return res.redirect(`/dashboard/videos?error=${encodeURIComponent('No file uploaded')}`);
    }

    try {
      // Get display name from original filename
      let displayName = path.basename(req.file.originalname, path.extname(req.file.originalname));

      // Check if a video with this display name already exists and auto-number if needed
      const baseDisplayName = displayName;
      let counter = 1;
      let finalDisplayName = displayName;
      
      while (true) {
        const existingVideo = await Video.findOne({
          where: {
            companyId: req.company.id,
            fileName: finalDisplayName,
          },
        });

        if (!existingVideo) {
          displayName = finalDisplayName;
          break;
        }

        finalDisplayName = `${baseDisplayName} (${counter})`;
        counter++;

        if (counter > 1000) {
          await deleteFile(path.join('videos', req.company.id, req.file.filename));
          return res.redirect(`/dashboard/videos?error=${encodeURIComponent('Unable to generate unique filename')}`);
        }
      }

      // Create video record
      await Video.create({
        companyId: req.company.id,
        uploadedBy: req.user.id,
        fileName: displayName,
        originalFileName: req.file.originalname,
        filePath: path.join('videos', req.company.id, req.file.filename),
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        metadata: {},
        isActive: true,
      });

      res.redirect(`/dashboard/videos?success=${encodeURIComponent('Video uploaded successfully!')}`);
    } catch (error) {
      console.error('Video upload error:', error);
      // Try to delete the uploaded file
      if (req.file) {
        await deleteFile(path.join('videos', req.company.id, req.file.filename));
      }
      res.redirect(`/dashboard/videos?error=${encodeURIComponent('Upload failed: ' + error.message)}`);
    }
  });
});

/**
 * POST /dashboard/videos/:videoId/edit
 * Edit video name
 */
router.post('/videos/:videoId/edit', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { fileName } = req.body;

    if (!fileName || !fileName.trim()) {
      return res.redirect(`/dashboard/videos?error=${encodeURIComponent('Video name cannot be empty')}`);
    }

    const video = await Video.findOne({
      where: {
        id: videoId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!video) {
      return res.redirect(`/dashboard/videos?error=${encodeURIComponent('Video not found')}`);
    }

    // Check if user has permission to edit
    const canEdit = 
      video.uploadedBy === req.user.id ||
      ['owner', 'admin', 'manager'].includes(req.userCompany.role);

    if (!canEdit) {
      return res.redirect(`/dashboard/videos?error=${encodeURIComponent('You do not have permission to edit this video')}`);
    }

    // Update video name
    await video.update({ fileName: fileName.trim() });

    res.redirect(`/dashboard/videos?success=${encodeURIComponent('Video name updated successfully!')}`);
  } catch (error) {
    console.error('Video edit error:', error);
    res.redirect(`/dashboard/videos?error=${encodeURIComponent('Update failed: ' + error.message)}`);
  }
});

/**
 * POST /dashboard/videos/:videoId/delete
 * Delete a single video
 */
router.post('/videos/:videoId/delete', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await Video.findOne({
      where: {
        id: videoId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!video) {
      return res.redirect(`/dashboard/videos?error=${encodeURIComponent('Video not found')}`);
    }

    // Check if user has permission to delete
    const canDelete = 
      video.uploadedBy === req.user.id ||
      ['owner', 'admin', 'manager'].includes(req.userCompany.role);

    if (!canDelete) {
      return res.redirect(`/dashboard/videos?error=${encodeURIComponent('You do not have permission to delete this video')}`);
    }

    // Check if video is used in any schedules
    const scheduleItems = await ScheduleItem.findAll({
      where: {
        videoId: videoId,
        isActive: true,
      },
      include: [{
        model: Schedule,
        as: 'schedule',
        where: {
          companyId: req.company.id,
          isActive: true,
        },
        attributes: ['id', 'name'],
      }],
    });

    // If video is in schedules, remove it from all schedules
    if (scheduleItems.length > 0) {
      await ScheduleItem.update(
        { isActive: false },
        {
          where: {
            videoId: videoId,
            isActive: true,
          },
        }
      );
    }

    // Delete file from filesystem
    await deleteFile(video.filePath);

    // Soft delete in database
    await video.update({ isActive: false });

    const message = scheduleItems.length > 0 
      ? `Video deleted successfully! (Removed from ${scheduleItems.length} schedule(s))`
      : 'Video deleted successfully!';

    res.redirect(`/dashboard/videos?success=${encodeURIComponent(message)}`);
  } catch (error) {
    console.error('Video delete error:', error);
    res.redirect(`/dashboard/videos?error=${encodeURIComponent('Delete failed: ' + error.message)}`);
  }
});

/**
 * POST /dashboard/videos/bulk-delete
 * Delete multiple videos
 */
router.post('/videos/bulk-delete', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const videoIds = req.body['videoIds[]'] || req.body.videoIds || [];
    const idsArray = Array.isArray(videoIds) ? videoIds : [videoIds];

    if (idsArray.length === 0) {
      return res.redirect(`/dashboard/videos?error=${encodeURIComponent('No videos selected')}`);
    }

    // Find all videos
    const videos = await Video.findAll({
      where: {
        id: idsArray,
        companyId: req.company.id,
        isActive: true,
      },
    });

    let deleted = 0;
    let failed = 0;
    let removedFromSchedules = 0;

    for (const video of videos) {
      try {
        // Check if user has permission to delete this video
        const canDelete = 
          video.uploadedBy === req.user.id ||
          ['owner', 'admin', 'manager'].includes(req.userCompany.role);

        if (!canDelete) {
          failed++;
          continue;
        }

        // Check and remove from schedules
        const scheduleItems = await ScheduleItem.findAll({
          where: {
            videoId: video.id,
            isActive: true,
          },
        });

        if (scheduleItems.length > 0) {
          await ScheduleItem.update(
            { isActive: false },
            {
              where: {
                videoId: video.id,
                isActive: true,
              },
            }
          );
          removedFromSchedules += scheduleItems.length;
        }

        // Delete file from filesystem
        await deleteFile(video.filePath);

        // Soft delete in database
        await video.update({ isActive: false });

        deleted++;
      } catch (error) {
        console.error(`Error deleting video ${video.id}:`, error);
        failed++;
      }
    }

    const message = `Successfully deleted ${deleted} video(s)` + 
                   (removedFromSchedules > 0 ? ` (Removed from ${removedFromSchedules} schedule(s))` : '') +
                   (failed > 0 ? `. ${failed} video(s) could not be deleted.` : '');

    res.redirect(`/dashboard/videos?success=${encodeURIComponent(message)}`);
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.redirect(`/dashboard?tab=uploads&error=${encodeURIComponent('Bulk delete failed: ' + error.message)}`);
  }
});

module.exports = router;

