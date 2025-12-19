/**
 * Video Management Routes
 * 
 * Endpoints for uploading, listing, and deleting video files
 * Each company has its own isolated video storage
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { Video, User } = require('../models');
const { verifyToken, requireRole } = require('../middleware/jwtAuth');
const { storageConfig } = require('../config');
const {
  ensureCompanyDir,
  deleteFile,
  isValidVideoMimeType,
} = require('../utils/fileStorage');

/**
 * Configure multer for video uploads
 * Files are stored in videos/{companyId}/ directory
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Ensure company directory exists
      const companyDir = await ensureCompanyDir(req.company.id);
      cb(null, companyDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Use original filename with timestamp to avoid immediate conflicts
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${safeName}_${timestamp}${ext}`);
  }
});

/**
 * File filter to only accept video files
 */
const fileFilter = (req, file, cb) => {
  if (isValidVideoMimeType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed'), false);
  }
};

/**
 * Multer upload configuration
 * Max file size configured in config.js
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: storageConfig.maxFileSizeBytes,
  }
});

/**
 * Helper function to validate UUID format
 */
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * POST /api/videos/upload
 * Upload a video file
 * Requires: accessToken, multipart/form-data with 'video' field
 * Allowed roles: owner, admin, manager, member
 */
router.post('/upload',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  (req, res, next) => {
    upload.single('video')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const maxSizeMB = (storageConfig.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
          return res.status(400).json({
            success: false,
            message: `File size too large. Maximum allowed size is ${maxSizeMB}MB`,
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed',
        });
      }
      next();
    });
  },
  [
    body('displayName').optional().trim().notEmpty().withMessage('Display name cannot be empty'),
    body('metadata').optional().isJSON().withMessage('Metadata must be valid JSON'),
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Delete uploaded file if validation fails
        if (req.file) {
          await deleteFile(path.join('videos', req.company.id, req.file.filename));
        }
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No video file provided',
        });
      }

      // Check company storage limit
      const companyStorageLimit = storageConfig.companyStorageLimitBytes;
      
      // Calculate current storage used by the company
      const currentUsage = await Video.sum('fileSize', {
        where: {
          companyId: req.company.id,
          isActive: true,
        }
      }) || 0;

      // Check if adding this file would exceed the limit
      const newTotalSize = currentUsage + req.file.size;
      if (newTotalSize > companyStorageLimit) {
        // Delete the uploaded file as it exceeds company limit
        await deleteFile(path.join('videos', req.company.id, req.file.filename));
        
        const currentUsageMB = (currentUsage / (1024 * 1024)).toFixed(2);
        const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
        const limitMB = (companyStorageLimit / (1024 * 1024)).toFixed(2);
        
        return res.status(413).json({
          success: false,
          message: `Company storage limit exceeded. Your company has used ${currentUsageMB}MB of ${limitMB}MB. This file (${fileSizeMB}MB) would exceed your storage quota.`,
          data: {
            currentUsage: currentUsage,
            fileSize: req.file.size,
            limit: companyStorageLimit,
            availableSpace: companyStorageLimit - currentUsage,
          }
        });
      }

      // Get display name from request or use original filename
      let displayName = req.body.displayName || path.basename(
        req.file.originalname,
        path.extname(req.file.originalname)
      );

      // Check if a video with this display name already exists and auto-number if needed
      // NOTE: Check ALL videos (active and inactive) because DB constraint applies to all
      const baseDisplayName = displayName;
      let counter = 1;
      let finalDisplayName = displayName;
      
      while (true) {
        const existingVideo = await Video.findOne({
          where: {
            companyId: req.company.id,
            fileName: finalDisplayName,
            // Don't filter by isActive - DB constraint applies to all records
          },
        });

        if (!existingVideo) {
          // Name is available
          displayName = finalDisplayName;
          break;
        }

        // Name exists, try next number
        finalDisplayName = `${baseDisplayName} (${counter})`;
        counter++;

        // Safety limit to prevent infinite loops
        if (counter > 1000) {
          await deleteFile(path.join('videos', req.company.id, req.file.filename));
          return res.status(400).json({
            success: false,
            message: 'Unable to generate unique filename. Please use a different name.',
          });
        }
      }

      // Parse metadata if provided
      let metadata = {};
      if (req.body.metadata) {
        try {
          metadata = JSON.parse(req.body.metadata);
        } catch (e) {
          metadata = {};
        }
      }

      // Create video record in database
      const video = await Video.create({
        companyId: req.company.id,
        uploadedBy: req.user.id,
        fileName: displayName,
        originalFileName: req.file.originalname,
        filePath: path.join('videos', req.company.id, req.file.filename),
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        metadata: metadata,
        isActive: true,
      });

      // Check if name was auto-numbered
      const wasRenamed = displayName !== baseDisplayName;

      res.status(201).json({
        success: true,
        message: wasRenamed 
          ? `Video uploaded successfully. Name was changed to "${displayName}" to avoid duplicates.`
          : 'Video uploaded successfully',
        data: {
          id: video.id,
          fileName: video.fileName,
          originalName: baseDisplayName,
          fileSize: video.fileSize,
          mimeType: video.mimeType,
          uploadedAt: video.createdAt,
          wasRenamed: wasRenamed,
        },
      });
    } catch (error) {
      console.error('Upload video error:', error);
      
      // Clean up uploaded file if database insert fails
      if (req.file) {
        try {
          await deleteFile(path.join('videos', req.company.id, req.file.filename));
          console.log('Cleaned up orphaned file:', req.file.filename);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }

      // Handle specific database errors
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'A video with this name already exists. Please use a different name.',
        });
      }

      res.status(500).json({
        success: false,
        message: 'An error occurred while uploading the video',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/videos/storage
 * Get storage usage statistics for the current company
 * Requires: accessToken
 * Allowed roles: All authenticated users
 */
router.get('/storage', verifyToken, async (req, res) => {
  try {
    const companyStorageLimit = storageConfig.companyStorageLimitBytes;
    
    // Calculate current storage used by the company
    const currentUsage = await Video.sum('fileSize', {
      where: {
        companyId: req.company.id,
        isActive: true,
      }
    }) || 0;

    // Get video count
    const videoCount = await Video.count({
      where: {
        companyId: req.company.id,
        isActive: true,
      }
    });

    const usagePercentage = ((currentUsage / companyStorageLimit) * 100).toFixed(2);
    const availableSpace = companyStorageLimit - currentUsage;

    res.json({
      success: true,
      data: {
        currentUsage: currentUsage,
        currentUsageMB: (currentUsage / (1024 * 1024)).toFixed(2),
        limit: companyStorageLimit,
        limitMB: (companyStorageLimit / (1024 * 1024)).toFixed(2),
        availableSpace: availableSpace,
        availableSpaceMB: (availableSpace / (1024 * 1024)).toFixed(2),
        usagePercentage: parseFloat(usagePercentage),
        videoCount: videoCount,
      },
    });
  } catch (error) {
    console.error('Get storage stats error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching storage statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/videos
 * List all videos for the current company
 * Requires: accessToken
 * Allowed roles: All authenticated users
 */
router.get('/', verifyToken, async (req, res) => {
  try {
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

    const formattedVideos = videos.map(video => ({
      id: video.id,
      fileName: video.fileName,
      originalFileName: video.originalFileName,
      fileSize: video.fileSize,
      mimeType: video.mimeType,
      duration: video.duration,
      resolution: video.resolution,
      metadata: video.metadata,
      uploadedBy: {
        id: video.uploader.id,
        email: video.uploader.email,
        name: `${video.uploader.firstName} ${video.uploader.lastName}`,
      },
      uploadedAt: video.createdAt,
      updatedAt: video.updatedAt,
    }));

    res.json({
      success: true,
      data: {
        videos: formattedVideos,
        count: formattedVideos.length,
      },
    });
  } catch (error) {
    console.error('List videos error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching videos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/videos/:videoId
 * Get details of a specific video
 * Requires: accessToken
 * Allowed roles: All authenticated users
 */
router.get('/:videoId', verifyToken, async (req, res) => {
  try {
    const { videoId } = req.params;

    // Validate UUID format
    if (!isValidUUID(videoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video ID format',
      });
    }

    const video = await Video.findOne({
      where: {
        id: videoId,
        companyId: req.company.id, // Ensure user can only access their company's videos
        isActive: true,
      },
      include: [{
        model: User,
        as: 'uploader',
        attributes: ['id', 'email', 'firstName', 'lastName'],
      }],
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: video.id,
        fileName: video.fileName,
        originalFileName: video.originalFileName,
        filePath: video.filePath,
        fileSize: video.fileSize,
        mimeType: video.mimeType,
        duration: video.duration,
        resolution: video.resolution,
        metadata: video.metadata,
        uploadedBy: {
          id: video.uploader.id,
          email: video.uploader.email,
          name: `${video.uploader.firstName} ${video.uploader.lastName}`,
        },
        uploadedAt: video.createdAt,
        updatedAt: video.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the video',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/videos/:videoId/download
 * Download or stream a video file
 * PUBLIC ENDPOINT - No authentication required
 * Supports: Range requests for video streaming
 * Perfect for: Digital signage displays, public viewing, embedded players
 */
router.get('/:videoId/download', async (req, res) => {
  try {
    const { videoId } = req.params;

    // Validate UUID format
    if (!isValidUUID(videoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video ID format',
      });
    }

    // Find video (public access - no company check)
    const video = await Video.findOne({
      where: {
        id: videoId,
        isActive: true,
      },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found',
      });
    }

    // Get full file path
    const filePath = path.join(__dirname, '..', video.filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('File not found on disk:', filePath);
      return res.status(404).json({
        success: false,
        message: 'Video file not found on server',
      });
    }

    // Get file stats
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // If range header exists, handle partial content (for video streaming)
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });

      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': video.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(video.fileName)}${path.extname(video.originalFileName)}"`,
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // No range header, send entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': video.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(video.fileName)}${path.extname(video.originalFileName)}"`,
        'Accept-Ranges': 'bytes',
      };

      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Download video error:', error);
    
    // If headers already sent, can't send JSON response
    if (res.headersSent) {
      return res.end();
    }
    
    res.status(500).json({
      success: false,
      message: 'An error occurred while downloading the video',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * PUT /api/videos/:videoId
 * Update video metadata (display name, metadata)
 * Requires: accessToken
 * Allowed roles: owner, admin, manager, member (only uploader or higher roles)
 */
router.put('/:videoId',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  [
    body('fileName').optional().trim().notEmpty().withMessage('File name cannot be empty'),
    body('metadata').optional().isObject().withMessage('Metadata must be an object'),
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

      const { videoId } = req.params;
      const { fileName, metadata } = req.body;

      // Validate UUID format
      if (!isValidUUID(videoId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid video ID format',
        });
      }

      const video = await Video.findOne({
        where: {
          id: videoId,
          companyId: req.company.id,
          isActive: true,
        },
      });

      if (!video) {
        return res.status(404).json({
          success: false,
          message: 'Video not found',
        });
      }

      // Check if user has permission to update
      // Only uploader, or owner/admin can update
      const canUpdate = 
        video.uploadedBy === req.user.id ||
        ['owner', 'admin'].includes(req.userCompany.role);

      if (!canUpdate) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this video',
        });
      }

      // Check if new fileName already exists
      if (fileName && fileName !== video.fileName) {
        const existingVideo = await Video.findOne({
          where: {
            companyId: req.company.id,
            fileName: fileName,
            isActive: true,
            id: { [require('sequelize').Op.ne]: videoId },
          },
        });

        if (existingVideo) {
          return res.status(409).json({
            success: false,
            message: 'A video with this name already exists',
          });
        }
      }

      // Update video
      const updateData = {};
      if (fileName !== undefined) updateData.fileName = fileName;
      if (metadata !== undefined) updateData.metadata = metadata;

      await video.update(updateData);

      res.json({
        success: true,
        message: 'Video updated successfully',
        data: {
          id: video.id,
          fileName: video.fileName,
          metadata: video.metadata,
          updatedAt: video.updatedAt,
        },
      });
    } catch (error) {
      console.error('Update video error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while updating the video',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * DELETE /api/videos/:videoId
 * Delete a video (soft delete in DB, hard delete file)
 * Requires: accessToken
 * Allowed roles: owner, admin, manager (or the uploader)
 */
router.delete('/:videoId',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  async (req, res) => {
    try {
      const { videoId } = req.params;

      // Validate UUID format
      if (!isValidUUID(videoId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid video ID format',
        });
      }

      const video = await Video.findOne({
        where: {
          id: videoId,
          companyId: req.company.id, // Ensure user can only delete their company's videos
          isActive: true,
        },
      });

      if (!video) {
        return res.status(404).json({
          success: false,
          message: 'Video not found',
        });
      }

      // Check if user has permission to delete
      // Only uploader, or owner/admin/manager can delete
      const canDelete = 
        video.uploadedBy === req.user.id ||
        ['owner', 'admin', 'manager'].includes(req.userCompany.role);

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this video',
        });
      }

      // Delete file from filesystem
      const fileDeleted = await deleteFile(video.filePath);

      // Soft delete in database
      await video.update({ isActive: false });

      res.json({
        success: true,
        message: 'Video deleted successfully',
        data: {
          id: video.id,
          fileName: video.fileName,
          fileDeleted: fileDeleted,
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Delete video error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while deleting the video',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/videos/bulk-delete
 * Delete multiple videos in one request
 * Requires: accessToken
 * Allowed roles: owner, admin, manager (or the uploader for each video)
 */
router.post('/bulk-delete',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  [
    body('videoIds')
      .isArray({ min: 1 })
      .withMessage('videoIds must be a non-empty array'),
    body('videoIds.*')
      .isUUID()
      .withMessage('All video IDs must be valid UUIDs'),
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

      const { videoIds } = req.body;

      // Limit bulk operations to prevent abuse
      if (videoIds.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 100 videos can be deleted at once',
        });
      }

      // Find all videos that match the IDs and belong to the company
      const videos = await Video.findAll({
        where: {
          id: videoIds,
          companyId: req.company.id,
          isActive: true,
        },
      });

      if (videos.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No videos found',
        });
      }

      // Check permissions for each video
      const results = {
        deleted: [],
        failed: [],
      };

      for (const video of videos) {
        try {
          // Check if user has permission to delete this video
          const canDelete = 
            video.uploadedBy === req.user.id ||
            ['owner', 'admin', 'manager'].includes(req.userCompany.role);

          if (!canDelete) {
            results.failed.push({
              id: video.id,
              fileName: video.fileName,
              reason: 'Insufficient permissions',
            });
            continue;
          }

          // Delete file from filesystem
          const fileDeleted = await deleteFile(video.filePath);

          // Soft delete in database
          await video.update({ isActive: false });

          results.deleted.push({
            id: video.id,
            fileName: video.fileName,
            fileDeleted: fileDeleted,
          });
        } catch (error) {
          console.error(`Error deleting video ${video.id}:`, error);
          results.failed.push({
            id: video.id,
            fileName: video.fileName,
            reason: error.message || 'Unknown error',
          });
        }
      }

      // Check if any requested IDs were not found
      const foundIds = videos.map(v => v.id);
      const notFoundIds = videoIds.filter(id => !foundIds.includes(id));
      
      if (notFoundIds.length > 0) {
        notFoundIds.forEach(id => {
          results.failed.push({
            id: id,
            fileName: 'Unknown',
            reason: 'Video not found or already deleted',
          });
        });
      }

      const statusCode = results.deleted.length > 0 ? 200 : 
                        results.failed.length > 0 ? 207 : 404;

      res.status(statusCode).json({
        success: results.deleted.length > 0,
        message: `Deleted ${results.deleted.length} video(s), ${results.failed.length} failed`,
        data: {
          deleted: results.deleted,
          failed: results.failed,
          summary: {
            total: videoIds.length,
            deletedCount: results.deleted.length,
            failedCount: results.failed.length,
          },
        },
      });
    } catch (error) {
      console.error('Bulk delete error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred during bulk delete',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

module.exports = router;

