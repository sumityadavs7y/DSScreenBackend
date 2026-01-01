/**
 * Video Management Routes
 * 
 * Endpoints for uploading, listing, and deleting video files
 * Each company has its own isolated video storage
 */

const express = require('express');
const router = express.Router();
const { createModuleLogger } = require('../utils/logger');
const log = createModuleLogger('Video');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const { Video, User, ScheduleItem, Schedule, Company } = require('../models');
const { requireAuth, requireCompany, requireRole } = require('../middleware/sessionAuth');
const { checkCompanyLicense } = require('../middleware/licenseCheck');
const verifyToken = requireAuth; // Alias for compatibility
const { storageConfig, envConfig } = require('../config');
const {
  isValidVideoMimeType,
  isValidMediaMimeType,
  isImageMimeType,
  getDefaultDuration,
} = require('../utils/fileStorage');
const {
  generateS3Key,
  generateThumbnailS3Key,
  uploadToS3,
  uploadBufferToS3,
  deleteFromS3,
  getS3Metadata,
  getS3ObjectRange,
  getUploadSignedUrl,
  downloadFromS3,
} = require('../utils/s3Storage');
const { extractVideoMetadata, generateThumbnailAtPercentage } = require('../utils/videoMetadata');
const { sequelize } = require('../models/sequelize');

/**
 * Configure multer for video uploads
 * Files are temporarily stored in memory before uploading to S3
 */
const storage = multer.memoryStorage();

/**
 * File filter to accept video and image files
 */
const fileFilter = (req, file, cb) => {
  if (isValidMediaMimeType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only video and image files are allowed'), false);
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
 * POST /api/media/request-upload-url
 * Request a pre-signed URL for direct S3 upload
 * Requires: accessToken
 * Allowed roles: owner, admin, manager, member
 */
router.post('/request-upload-url',
  verifyToken,
  requireCompany,
  requireRole('owner', 'admin', 'manager', 'member'),
  checkCompanyLicense,
  [
    body('fileName').trim().notEmpty().withMessage('File name is required'),
    body('fileSize').isInt({ min: 1 }).withMessage('File size must be a positive integer'),
    body('mimeType').trim().notEmpty().withMessage('MIME type is required'),
    body('displayName').optional().trim().notEmpty().withMessage('Display name cannot be empty'),
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

      const { fileName, fileSize, mimeType, displayName } = req.body;

      // Validate media MIME type (video or image)
      if (!isValidMediaMimeType(mimeType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid media file type. Supported formats: Videos (MP4, WebM, etc.) and Images (JPG, PNG, GIF, WebP)',
        });
      }

      // Check file size against config
      if (fileSize > storageConfig.maxFileSizeBytes) {
        const maxSizeMB = (storageConfig.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        return res.status(400).json({
          success: false,
          message: `File size (${fileSizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB`,
        });
      }

      // Check company storage limit
      const { License } = require('../models');
      const activeLicense = await License.findOne({
        where: {
          companyId: req.company.id,
          isActive: true,
        }
      });
      
      const companyStorageLimit = activeLicense?.maxStorageBytes || storageConfig.companyStorageLimitBytes;
      
      // Calculate actual storage used (only count active videos)
      const currentUsage = await Video.sum('fileSize', {
        where: {
          companyId: req.company.id,
          isActive: true,
        }
      }) || 0;
      
      const newTotalSize = currentUsage + fileSize;

      console.log('📊 Storage check:', {
        currentUsageMB: (currentUsage / (1024 * 1024)).toFixed(2),
        newFileMB: (fileSize / (1024 * 1024)).toFixed(2),
        totalAfterMB: (newTotalSize / (1024 * 1024)).toFixed(2),
        limitMB: (companyStorageLimit / (1024 * 1024)).toFixed(2),
        wouldExceed: newTotalSize > companyStorageLimit,
      });

      if (newTotalSize > companyStorageLimit) {
        const currentUsageMB = (currentUsage / (1024 * 1024)).toFixed(2);
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        const limitMB = (companyStorageLimit / (1024 * 1024)).toFixed(2);
        
        return res.status(413).json({
          success: false,
          message: `Company storage limit exceeded. Your company has used ${currentUsageMB}MB of ${limitMB}MB. This file (${fileSizeMB}MB) would exceed your storage quota.`,
          data: {
            currentUsage: currentUsage,
            fileSize: fileSize,
            limit: companyStorageLimit,
            availableSpace: companyStorageLimit - currentUsage,
          }
        });
      }

      // Get display name
      let finalDisplayName = displayName || path.basename(fileName, path.extname(fileName));

      // Check for duplicate names and auto-number if needed
      // Only check active videos - inactive ones are from failed uploads
      const baseDisplayName = finalDisplayName;
      let counter = 1;
      
      while (true) {
        const existingVideo = await Video.findOne({
          where: {
            companyId: req.company.id,
            fileName: finalDisplayName,
            isActive: true, // Only check active videos
          },
        });

        if (!existingVideo) {
          break;
        }

        finalDisplayName = `${baseDisplayName} (${counter})`;
        counter++;

        if (counter > 1000) {
          return res.status(400).json({
            success: false,
            message: 'Unable to generate unique filename. Please use a different name.',
          });
        }
      }

      // Clean up any orphaned inactive videos with the same name
      // (from previous failed uploads)
      // IMPORTANT: Use force: true to hard delete, otherwise unique constraint still applies
      await Video.destroy({
        where: {
          companyId: req.company.id,
          fileName: finalDisplayName,
          isActive: false,
        },
        force: true, // Hard delete - actually remove from database
      });

      // Create media record in database (status: uploading)
      // For images, set default duration of 10 seconds
      const defaultDuration = getDefaultDuration(mimeType);
      
      const video = await Video.create({
        companyId: req.company.id,
        uploadedBy: req.user.id,
        fileName: finalDisplayName,
        originalFileName: fileName,
        filePath: '', // Will be updated after upload
        fileSize: fileSize,
        mimeType: mimeType,
        duration: defaultDuration, // 10 seconds for images, null for videos
        metadata: { 
          uploadStatus: 'pending',
          mediaType: isImageMimeType(mimeType) ? 'image' : 'video',
        },
        isActive: false, // Will be activated after successful upload
      });

      // Generate S3 key
      const env = envConfig.envMode === 'production' ? 'prod' : 'dev';
      const ext = path.extname(fileName);
      const s3Key = generateS3Key(env, req.company.name, req.company.id, video.id, ext);

      // Generate pre-signed URL
      const uploadUrl = getUploadSignedUrl(s3Key, mimeType, 900); // 15 minutes expiry

      // Update video with S3 key
      await video.update({ filePath: s3Key });

      res.status(200).json({
        success: true,
        message: 'Upload URL generated successfully',
        data: {
          videoId: video.id,
          uploadUrl: uploadUrl.url,
          s3Key: uploadUrl.key,
          fileName: finalDisplayName,
          expiresIn: 900, // 15 minutes
          wasRenamed: finalDisplayName !== baseDisplayName,
        },
      });
    } catch (error) {
      console.error('Request upload URL error:', error);
      
      // Handle unique constraint violation
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'A video with this name already exists. Please try a different name or delete the existing video first.',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'An error occurred while generating upload URL',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/media/:videoId/complete-upload
 * Complete the upload process after direct S3 upload
 * Extracts metadata and generates thumbnail
 * Requires: accessToken
 * Allowed roles: owner, admin, manager, member
 */
router.post('/:videoId/complete-upload',
  verifyToken,
  requireCompany,
  requireRole('owner', 'admin', 'manager', 'member'),
  async (req, res) => {
    try {
      const { videoId } = req.params;

      if (!isValidUUID(videoId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid video ID format',
        });
      }

      // Find video record
      const video = await Video.findOne({
        where: {
          id: videoId,
          companyId: req.company.id,
          uploadedBy: req.user.id,
        },
      });

      if (!video) {
        return res.status(404).json({
          success: false,
          message: 'Video not found',
        });
      }

      if (video.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Video upload already completed',
        });
      }

      // Verify file exists in S3
      const s3Key = video.filePath;
      const fileExists = await getS3Metadata(s3Key).then(() => true).catch(() => false);

      if (!fileExists) {
        return res.status(404).json({
          success: false,
          message: 'Video file not found in storage. Upload may have failed.',
        });
      }

      // Check if this is an image or video
      const isImage = isImageMimeType(video.mimeType);
      
      let videoMetadata = {};
      let duration = video.duration; // For images, already set to 10 seconds
      let resolution = null;
      let thumbnailPath = null;
      
      if (isImage) {
        // For images, use the image itself as thumbnail (no processing needed)
        console.log('🖼️  Processing image upload');
        
        videoMetadata = {
          mediaType: 'image',
          uploadStatus: 'completed',
        };
        
        // For images, thumbnail is the image itself
        thumbnailPath = s3Key;
        console.log('✅ Image uploaded successfully:', s3Key);
        
      } else {
        // For videos, download and process
        console.log('🎥 Processing video upload');
        
        const ext = path.extname(video.originalFileName);
        const tempFilePath = path.join('/tmp', `${video.id}${ext}`);
        
        try {
          await downloadFromS3(s3Key, tempFilePath);

          // Extract video metadata
          try {
            const extractedMetadata = await extractVideoMetadata(tempFilePath);
            
            duration = extractedMetadata.duration;
            resolution = extractedMetadata.resolution;
            videoMetadata = {
              mediaType: 'video',
              codec: extractedMetadata.codec,
              bitrate: extractedMetadata.bitrate,
              fps: extractedMetadata.fps,
              format: extractedMetadata.format,
              uploadStatus: 'completed',
            };

            console.log('✅ Video metadata extracted:', { duration, resolution });

            // Generate thumbnail
            try {
              const thumbnailTempPath = path.join('/tmp', `${video.id}_thumb.jpg`);
              await generateThumbnailAtPercentage(tempFilePath, thumbnailTempPath, 10);
              
              // Upload thumbnail to S3
              const env = envConfig.envMode === 'production' ? 'prod' : 'dev';
              const thumbnailS3Key = generateThumbnailS3Key(env, req.company.name, req.company.id, video.id);
              const thumbnailBuffer = fs.readFileSync(thumbnailTempPath);
              await uploadBufferToS3(thumbnailBuffer, thumbnailS3Key, 'image/jpeg');
              thumbnailPath = thumbnailS3Key;
              
              // Clean up temp thumbnail
              fs.unlinkSync(thumbnailTempPath);
              
              console.log('✅ Thumbnail generated and uploaded:', thumbnailPath);
            } catch (thumbError) {
              console.error('⚠️  Failed to generate thumbnail:', thumbError.message);
            }
          } catch (metadataError) {
            console.error('⚠️  Failed to extract video metadata:', metadataError.message);
            videoMetadata = { mediaType: 'video', uploadStatus: 'completed_no_metadata' };
          }

          // Clean up temporary video file
          fs.unlinkSync(tempFilePath);
          
        } catch (downloadError) {
          console.error('❌ Failed to download video from S3 for processing:', downloadError);
          throw downloadError;
        }
      }
      
      // Continue with database update
      try {

        // ATOMIC UPDATE: Use transaction for database operations
        const transaction = await sequelize.transaction();
        
        try {
          // Update video record (within transaction)
          await video.update({
            duration: duration,
            resolution: resolution,
            thumbnailPath: thumbnailPath,
            metadata: videoMetadata,
            isActive: true,
          }, { transaction });

          // Update company storage usage (within transaction)
          await Company.increment('storageUsedBytes', {
            by: video.fileSize,
            where: { id: req.company.id },
            transaction,
          });

          // Commit transaction
          await transaction.commit();
          console.log('✅ Database transaction committed - Upload complete');

          res.status(200).json({
            success: true,
            message: 'Upload completed successfully',
            data: {
              id: video.id,
              fileName: video.fileName,
              fileSize: video.fileSize,
              duration: duration,
              resolution: resolution,
              hasThumbnail: !!thumbnailPath,
              uploadedAt: video.createdAt,
            },
          });
        } catch (dbError) {
          // Rollback transaction
          await transaction.rollback();
          console.error('❌ Database update failed, rolling back:', dbError);
          
          // CLEANUP: Delete S3 files since DB update failed (maintain atomicity)
          console.log('🗑️  Cleaning up S3 files due to database failure...');
          try {
            await deleteFromS3(s3Key);
            if (thumbnailPath) {
              await deleteFromS3(thumbnailPath);
            }
            console.log('✅ S3 cleanup complete');
          } catch (cleanupError) {
            console.error('⚠️  S3 cleanup failed:', cleanupError.message);
          }

          // Delete the database record too
          try {
            await video.destroy({ force: true });
            console.log('✅ Database record cleaned up');
          } catch (destroyError) {
            console.error('⚠️  Failed to cleanup database record:', destroyError.message);
          }

          return res.status(500).json({
            success: false,
            message: 'Failed to complete upload. All changes have been rolled back.',
            error: process.env.NODE_ENV === 'development' ? dbError.message : undefined,
          });
        }
      } catch (processingError) {
        console.error('Error processing uploaded media:', processingError);
        
        // Clean up temp file if it exists (only for videos)
        if (!isImage) {
          const ext = path.extname(video.originalFileName);
          const tempFilePath = path.join('/tmp', `${video.id}${ext}`);
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        }

        // ATOMIC FAILURE HANDLING: Delete S3 files if processing fails
        console.log('🗑️  Processing failed, cleaning up S3 files...');
        try {
          await deleteFromS3(s3Key);
          if (thumbnailPath && !isImage) { // Don't delete thumbnail for images (it's the image itself)
            await deleteFromS3(thumbnailPath);
          }
          console.log('✅ S3 cleanup complete');
        } catch (cleanupError) {
          console.error('⚠️  S3 cleanup failed:', cleanupError.message);
        }

        // Delete the incomplete database record
        try {
          await video.destroy({ force: true });
          console.log('✅ Database record cleaned up');
        } catch (destroyError) {
          console.error('⚠️  Failed to cleanup database record:', destroyError.message);
        }

        return res.status(500).json({
          success: false,
          message: 'Upload processing failed. All changes have been rolled back.',
          error: process.env.NODE_ENV === 'development' ? processingError.message : undefined,
        });
      }
    } catch (error) {
      console.error('Complete upload error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while completing the upload',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/media/upload
 * DEPRECATED: This endpoint has been removed to save server bandwidth
 * Use the direct S3 upload flow instead:
 *   1. POST /api/media/request-upload-url - Get pre-signed URL
 *   2. PUT to S3 URL - Upload directly from client to S3
 *   3. POST /api/media/:videoId/complete-upload - Complete the upload
 */
router.post('/upload',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  async (req, res) => {
    return res.status(410).json({
      success: false,
      message: 'This endpoint has been deprecated. Please use the direct S3 upload flow.',
      migration: {
        reason: 'Server-side uploads consume double bandwidth (client→server→S3). Direct uploads are faster and more efficient.',
        newFlow: [
          '1. POST /api/media/request-upload-url with {fileName, fileSize, mimeType}',
          '2. PUT directly to the returned uploadUrl with video file',
          '3. POST /api/media/{videoId}/complete-upload to finalize'
        ],
        documentation: 'See S3_DIRECT_UPLOAD_GUIDE.md for complete implementation guide'
      }
    });
  }
);

/**
 * REMOVED: The following 240+ lines of legacy upload code have been removed
 * Reason: Replaced by atomic direct S3 upload (see above endpoints)
 * Previous functionality:
 *   - Validated file upload
 *   - Checked storage limits
 *   - Uploaded through server to S3 (inefficient - double bandwidth!)
 *   - Created database record
 * New functionality:
 *   - Client uploads directly to S3 (single bandwidth usage)
 *   - Server only handles metadata and database operations
 *   - Atomic operations with automatic rollback
 *   - Better performance and reliability
 */

// Original implementation removed. If you need to restore it for some reason,
// check git history before this commit.

//router.post('/upload', ... 240+ lines removed ...);

// Continue with other endpoints below

/**
 * Legacy upload endpoint implementation has been completely removed.
 * All uploads now use the atomic direct S3 upload flow.
 * This saves ~240 lines of code and eliminates server bandwidth waste.
 */

// === END OF DEPRECATED UPLOAD ENDPOINT ===

/**
 * GET /api/media/storage
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
 * GET /api/media/:videoId
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
 * GET /api/media/:videoId/thumbnail
 * Get video thumbnail from S3
 * PUBLIC ENDPOINT - No authentication required
 */
router.get('/:videoId/thumbnail', async (req, res) => {
  try {
    const { videoId } = req.params;

    // Validate UUID format
    if (!isValidUUID(videoId)) {
      return res.status(404).send('Not found');
    }

    // Find video
    const video = await Video.findOne({
      where: {
        id: videoId,
        isActive: true,
      },
    });

    if (!video || !video.thumbnailPath) {
      return res.status(404).send('Thumbnail not found');
    }

    // Get thumbnail from S3
    try {
      const s3Data = await getS3ObjectRange(video.thumbnailPath, 'bytes=0-');
      
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': s3Data.ContentLength,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      });
      res.end(s3Data.Body);
    } catch (error) {
      console.error('Thumbnail not found in S3:', video.thumbnailPath);
      return res.status(404).send('Thumbnail not found');
    }
  } catch (error) {
    console.error('Get thumbnail error:', error);
    res.status(500).send('Error loading thumbnail');
  }
});

// In-memory cache for pre-signed URLs
// Structure: { videoId: { url: string, expiresAt: Date, data: object } }
const urlCache = new Map();

// Cache duration: 25 minutes (5 min buffer before 30 min expiry)
const CACHE_DURATION_MS = 25 * 60 * 1000;

/**
 * GET /api/media/:videoId/stream-url
 * Get a pre-signed URL for direct S3 streaming (no server bandwidth)
 * Returns a secure, temporary URL that expires in 30 minutes
 * Uses caching: Multiple devices get the same URL (efficient for 1000s of devices)
 * PUBLIC ENDPOINT - No authentication required (URL is secure and temporary)
 * Perfect for: Device players, direct video streaming
 */
router.get('/:videoId/stream-url', async (req, res) => {
  try {
    const { videoId } = req.params;

    // Validate UUID format
    if (!isValidUUID(videoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid video ID format',
      });
    }

    // Check cache first
    const cached = urlCache.get(videoId);
    const now = Date.now();
    
    if (cached && now < cached.expiresAt) {
      console.log(`✅ Returning cached stream URL for video: ${videoId} (cache hit)`);
      return res.json({
        success: true,
        data: {
          ...cached.data,
          cached: true,
          cacheExpiresAt: new Date(cached.expiresAt).toISOString(),
        },
      });
    }

    // Cache miss or expired - generate new URL
    if (cached) {
      console.log(`🔄 Cache expired for video: ${videoId}, generating new URL`);
      urlCache.delete(videoId);
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

    // Get S3 key from video filePath
    const s3Key = video.filePath;

    // Check if file exists in S3
    const { s3FileExists } = require('../utils/s3Storage');
    const fileExists = await s3FileExists(s3Key);
    
    if (!fileExists) {
      console.error('Video file not found in S3:', s3Key);
      return res.status(404).json({
        success: false,
        message: 'Video file not found in storage',
      });
    }

    // Generate pre-signed URL for direct S3 access (30 minutes expiry)
    const { getDownloadSignedUrl } = require('../utils/s3Storage');
    const signedUrlData = getDownloadSignedUrl(s3Key, 1800); // 1800 seconds = 30 minutes

    // Prepare response data
    const responseData = {
      streamUrl: signedUrlData.url,
      videoId: video.id,
      fileName: video.fileName,
      fileSize: video.fileSize,
      duration: video.duration,
      expiresIn: signedUrlData.expiresIn,
      expiresAt: signedUrlData.expiresAt,
      cached: false,
    };

    // Cache the URL (expires 5 min before S3 URL expires)
    urlCache.set(videoId, {
      data: responseData,
      expiresAt: now + CACHE_DURATION_MS,
    });

    console.log(`✅ Generated & cached stream URL for video: ${video.fileName} (cache for 25 min)`);

    return res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Error generating stream URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate stream URL',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Cleanup expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [videoId, cached] of urlCache.entries()) {
    if (now >= cached.expiresAt) {
      urlCache.delete(videoId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned ${cleanedCount} expired URL(s) from cache`);
  }
}, 10 * 60 * 1000);

/**
 * GET /api/media/:videoId/download
 * Download or stream a video file from S3 (LEGACY - streams through server)
 * NOTE: For better performance, use /stream-url endpoint for direct S3 access
 * PUBLIC ENDPOINT - No authentication required
 * Supports: Range requests for video streaming
 * Perfect for: Backwards compatibility, server-side processing
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

    // Get S3 key from video filePath
    const s3Key = video.filePath;

    // Get file metadata from S3
    let metadata;
    try {
      metadata = await getS3Metadata(s3Key);
    } catch (error) {
      console.error('File not found in S3:', s3Key);
      return res.status(404).json({
        success: false,
        message: 'Video file not found in storage',
      });
    }

    const fileSize = metadata.ContentLength;
    const range = req.headers.range;

    // If range header exists, handle partial content (for video streaming)
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      // Get object from S3 with range
      const rangeHeader = `bytes=${start}-${end}`;
      const s3Data = await getS3ObjectRange(s3Key, rangeHeader);

      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': video.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(video.fileName)}${path.extname(video.originalFileName)}"`,
      };

      res.writeHead(206, head);
      res.end(s3Data.Body);
    } else {
      // No range header, send entire file
      const s3Data = await getS3ObjectRange(s3Key, `bytes=0-${fileSize - 1}`);

      const head = {
        'Content-Length': fileSize,
        'Content-Type': video.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(video.fileName)}${path.extname(video.originalFileName)}"`,
        'Accept-Ranges': 'bytes',
      };

      res.writeHead(200, head);
      res.end(s3Data.Body);
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
 * PUT /api/media/:videoId
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
 * GET /api/media/:videoId/schedule-usage
 * Check if video is used in any schedules
 * Requires: accessToken
 */
router.get('/:videoId/schedule-usage',
  verifyToken,
  async (req, res) => {
    try {
      const { videoId } = req.params;

      if (!isValidUUID(videoId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid video ID format',
        });
      }

      // Find all schedule items using this video
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
          attributes: ['id', 'name', 'description'],
        }],
      });

      res.json({
        success: true,
        data: {
          isUsed: scheduleItems.length > 0,
          usageCount: scheduleItems.length,
          schedules: scheduleItems.map(item => ({
            scheduleId: item.schedule.id,
            scheduleName: item.schedule.name,
            scheduleDescription: item.schedule.description,
            itemId: item.id,
            startTime: item.startTime,
          })),
        },
      });
    } catch (error) {
      console.error('Check video usage error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while checking video usage',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * DELETE /api/media/:videoId
 * Delete a video (soft delete in DB, hard delete file)
 * Also removes video from all schedules if forceDelete=true
 * Requires: accessToken
 * Allowed roles: owner, admin, manager (or the uploader)
 */
router.delete('/:videoId',
  verifyToken,
  requireRole('owner', 'admin', 'manager', 'member'),
  async (req, res) => {
    try {
      const { videoId } = req.params;
      const { forceDelete } = req.query; // Query param to force delete even if in schedules

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

      // If video is in schedules and forceDelete is not true, return error
      if (scheduleItems.length > 0 && forceDelete !== 'true') {
        return res.status(409).json({
          success: false,
          message: 'Video is currently used in schedules',
          data: {
            usageCount: scheduleItems.length,
            schedules: scheduleItems.map(item => ({
              scheduleId: item.schedule.id,
              scheduleName: item.schedule.name,
              itemId: item.id,
            })),
          },
        });
      }

      // ATOMIC DELETE OPERATION
      // Strategy: Delete from S3 first, then database (within transaction)
      // If S3 delete fails, we don't delete from database (maintains consistency)
      
      const transaction = await sequelize.transaction();
      
      try {
        // Step 1: Delete from S3 first (outside transaction)
        console.log(`🗑️  Deleting video from S3: ${video.filePath}`);
        const fileDeleted = await deleteFromS3(video.filePath);
        
        if (!fileDeleted) {
          throw new Error('Failed to delete video file from S3');
        }
        
        console.log('✅ Video deleted from S3');

        // Step 2: Delete thumbnail from S3 if exists
        if (video.thumbnailPath) {
          console.log(`🗑️  Deleting thumbnail from S3: ${video.thumbnailPath}`);
          try {
            await deleteFromS3(video.thumbnailPath);
            console.log('✅ Thumbnail deleted from S3');
          } catch (thumbError) {
            console.warn('⚠️  Thumbnail delete failed, continuing:', thumbError.message);
            // Non-critical, continue
          }
        }

        // Step 3: Remove from schedules if needed (within transaction)
        if (scheduleItems.length > 0 && forceDelete === 'true') {
          await ScheduleItem.update(
            { isActive: false },
            {
              where: {
                videoId: videoId,
                isActive: true,
              },
              transaction,
            }
          );
          console.log(`✅ Removed from ${scheduleItems.length} schedule(s)`);
        }

        // Step 4: Delete from database (within transaction)
        console.log('🗑️  Deleting video from database');
        await video.destroy({ force: true, transaction });
        console.log('✅ Video deleted from database');

        // Step 5: Update company storage usage (within transaction)
        await Company.decrement('storageUsedBytes', {
          by: video.fileSize,
          where: { id: req.company.id },
          transaction,
        });
        console.log('✅ Storage usage updated');

        // Commit transaction
        await transaction.commit();
        console.log('✅ Transaction committed - Delete operation complete');

        // Invalidate cached URL for this video
        if (urlCache.has(videoId)) {
          urlCache.delete(videoId);
          console.log('✅ Invalidated cached stream URL');
        }

        res.json({
          success: true,
          message: 'Video deleted successfully',
          data: {
            id: video.id,
            fileName: video.fileName,
            fileDeleted: true,
            removedFromSchedules: scheduleItems.length,
            deletedAt: new Date(),
          },
        });
      } catch (deleteError) {
        // Rollback transaction
        await transaction.rollback();
        console.error('❌ Delete operation failed, transaction rolled back:', deleteError);

        return res.status(500).json({
          success: false,
          message: 'Failed to delete video. The operation has been rolled back.',
          error: process.env.NODE_ENV === 'development' ? deleteError.message : undefined,
        });
      }
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
 * POST /api/media/bulk-delete
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
    body('forceDelete')
      .optional()
      .isBoolean()
      .withMessage('forceDelete must be a boolean'),
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

      const { videoIds, forceDelete } = req.body;

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

          // Check if video is used in schedules
          const scheduleItems = await ScheduleItem.findAll({
            where: {
              videoId: video.id,
              isActive: true,
            },
          });

          // If video is in schedules and forceDelete is not true, skip
          if (scheduleItems.length > 0 && !forceDelete) {
            results.failed.push({
              id: video.id,
              fileName: video.fileName,
              reason: `Used in ${scheduleItems.length} schedule(s)`,
              usedInSchedules: true,
            });
            continue;
          }

          // If forceDelete is true, remove from all schedules first
          if (scheduleItems.length > 0 && forceDelete) {
            await ScheduleItem.update(
              { isActive: false },
              {
                where: {
                  videoId: video.id,
                  isActive: true,
                },
              }
            );
          }

          // ATOMIC DELETE: S3 first, then DB in transaction
          const videoTransaction = await sequelize.transaction();
          
          try {
            // Delete from S3 first
            const fileDeleted = await deleteFromS3(video.filePath);
            
            if (!fileDeleted) {
              throw new Error('S3 delete failed');
            }

            // Delete thumbnail if exists
            if (video.thumbnailPath) {
              try {
                await deleteFromS3(video.thumbnailPath);
              } catch (thumbError) {
                console.warn(`⚠️  Thumbnail delete failed for ${video.id}, continuing`);
              }
            }

            // Remove from schedules if needed
            if (scheduleItems.length > 0 && forceDelete) {
              await ScheduleItem.update(
                { isActive: false },
                {
                  where: {
                    videoId: video.id,
                    isActive: true,
                  },
                  transaction: videoTransaction,
                }
              );
            }

            // Delete from database
            await video.destroy({ force: true, transaction: videoTransaction });

            // Commit transaction
            await videoTransaction.commit();

            // Invalidate cached URL for this video
            if (urlCache.has(video.id)) {
              urlCache.delete(video.id);
            }

            results.deleted.push({
              id: video.id,
              fileName: video.fileName,
              fileDeleted: true,
              removedFromSchedules: scheduleItems.length,
            });
          } catch (error) {
            // Rollback transaction
            await videoTransaction.rollback();
            
            results.failed.push({
              id: video.id,
              fileName: video.fileName,
              reason: `Delete failed: ${error.message}`,
            });
          }
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

