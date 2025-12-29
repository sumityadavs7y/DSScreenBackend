const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Video, User, Company, UserCompany, License } = require('../models');
const { webRequireAuth, webRequireCompany } = require('../middleware/sessionAuth');
const { webCheckCompanyLicense } = require('../middleware/licenseCheck');
const { isValidVideoMimeType } = require('../utils/fileStorage');
const { storageConfig, envConfig } = require('../config');
const { extractVideoMetadata, generateThumbnailAtPercentage } = require('../utils/videoMetadata');
const {
  generateS3Key,
  generateThumbnailS3Key,
  uploadToS3,
  uploadBufferToS3,
  deleteFromS3,
} = require('../utils/s3Storage');
const { sequelize } = require('../models/sequelize');

/**
 * Configure multer for video uploads
 * Files are temporarily stored in memory before uploading to S3
 */
const storage = multer.memoryStorage();

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
 * Redirect to media library by default
 */
router.get('/', webRequireAuth, async (req, res) => {
  // If user is super admin and not impersonating, redirect to admin panel
  if (req.user && req.user.isSuperAdmin && !req.session.impersonating) {
    return res.redirect('/admin');
  }
  
  // Check if user has company context
  if (!req.session.companyId) {
    return res.redirect('/company-selection');
  }
  
  // Load company context
  try {
    const company = await Company.findByPk(req.session.companyId);
    if (!company || !company.isActive) {
      delete req.session.companyId;
      delete req.session.role;
      return res.redirect('/company-selection');
    }

    // Skip UserCompany check if super admin is impersonating
    if (!req.session.impersonating || !req.session.originalSuperAdminId) {
      const userCompany = await UserCompany.findOne({
        where: {
          userId: req.session.userId,
          companyId: req.session.companyId,
          isActive: true,
        },
      });

      if (!userCompany) {
        delete req.session.companyId;
        delete req.session.role;
        return res.redirect('/company-selection');
      }
    }

  res.redirect('/dashboard/media');
  } catch (error) {
    console.error('Dashboard redirect error:', error);
    res.redirect('/company-selection');
  }
});

/**
 * GET /dashboard/media
 * Media library page
 */
router.get('/media', webRequireAuth, webRequireCompany, async (req, res) => {
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
      thumbnailPath: video.thumbnailPath,
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
      session: req.session,
      videos: formattedVideos,
    });
  } catch (error) {
    console.error('Media library error:', error);
    res.status(500).send('Error loading media library');
  }
});

/**
 * GET /dashboard/playlists
 * Playlists page - lists all playlists for the company
 */
router.get('/playlists', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const { Playlist, PlaylistItem, User } = require('../models');
    
    const playlists = await Playlist.findAll({
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
          model: PlaylistItem,
          as: 'items',
          attributes: ['id'],
          required: false,
        }
      ],
      order: [['createdAt', 'DESC']],
    });

    // Convert to plain objects and debug logging
    const playlistsData = playlists.map(p => p.toJSON());
    
    console.log('📋 Found', playlistsData.length, 'playlists');
    playlistsData.forEach(playlist => {
      console.log(`  - ${playlist.name}: ${playlist.items?.length || 0} items`);
    });

    res.render('playlists', {
      user: req.user,
      company: req.company,
      userCompany: req.userCompany,
      session: req.session,
      playlists: playlistsData,
    });
  } catch (error) {
    console.error('Playlists error:', error);
    res.status(500).send('Error loading playlists');
  }
});

/**
 * GET /dashboard/playlists/:playlistId/timeline
 * Timeline management page for a playlist
 */
router.get('/playlists/:playlistId/timeline', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const { Playlist, PlaylistItem, Video } = require('../models');
    const { playlistId } = req.params;

    // Find the playlist
    const playlist = await Playlist.findOne({
      where: {
        id: playlistId,
        companyId: req.company.id,
        isActive: true,
      },
      include: [{
        model: PlaylistItem,
        as: 'items',
        include: [{
          model: Video,
          as: 'video',
        }],
      }],
      order: [[{ model: PlaylistItem, as: 'items' }, 'order', 'ASC']],
    });

    if (!playlist) {
      return res.redirect('/dashboard/playlists?error=' + encodeURIComponent('Playlist not found'));
    }

    // Load all videos for the company (for adding to playlist)
    const allVideos = await Video.findAll({
      where: {
        companyId: req.company.id,
        isActive: true,
      },
      order: [['fileName', 'ASC']],
    });

    res.render('playlist-timeline', {
      user: req.user,
      company: req.company,
      userCompany: req.userCompany,
      session: req.session,
      playlist: playlist,
      videos: allVideos,
      availableVideos: allVideos,
    });
  } catch (error) {
    console.error('Playlist timeline error:', error);
    res.redirect('/dashboard/playlists?error=' + encodeURIComponent('Error loading playlist timeline'));
  }
});

/**
 * POST /dashboard/playlists/create
 * Create a new playlist
 */
router.post('/playlists/create', webRequireAuth, webRequireCompany, webCheckCompanyLicense, async (req, res) => {
  try {
    const { Playlist } = require('../models');
    const { generateUniqueCode } = require('../utils/playlistCode');
    const { name, description } = req.body;

    // Validate input
    if (!name || name.trim().length === 0) {
      return res.redirect('/dashboard/playlists?error=' + encodeURIComponent('Playlist name is required'));
    }

    // Generate unique code
    const code = await generateUniqueCode(Playlist);

    // Create playlist
    const playlist = await Playlist.create({
      companyId: req.company.id,
      name: name.trim(),
      description: description?.trim() || null,
      code: code,
      isActive: true,
      createdBy: req.user.id,
    });

    res.redirect(`/dashboard/playlists/${playlist.id}/timeline?success=` + encodeURIComponent('Playlist created successfully!'));
  } catch (error) {
    console.error('Playlist creation error:', error);
    res.redirect('/dashboard/playlists?error=' + encodeURIComponent('Error creating playlist'));
  }
});

/**
 * POST /dashboard/playlists/:playlistId/timeline/add
 * Add a video to playlist timeline
 */
router.post('/playlists/:playlistId/timeline/add', webRequireAuth, webRequireCompany, webCheckCompanyLicense, async (req, res) => {
  try {
    const { Playlist, PlaylistItem, Video } = require('../models');
    const { playlistId } = req.params;
    const { videoId, duration } = req.body;

    // Validate input
    if (!videoId) {
      return res.status(400).json({ success: false, error: 'Video is required' });
    }

    if (!duration || duration <= 0) {
      return res.status(400).json({ success: false, error: 'Duration must be greater than 0' });
    }

    // Verify playlist belongs to company
    const playlist = await Playlist.findOne({
      where: {
        id: playlistId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist not found' });
    }

    // Verify video belongs to company
    const video = await Video.findOne({
      where: {
        id: videoId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!video) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    // Get the current max order for this playlist
    const maxOrderItem = await PlaylistItem.findOne({
      where: { playlistId },
      order: [['order', 'DESC']],
      attributes: ['order'],
    });

    const nextOrder = maxOrderItem ? maxOrderItem.order + 1 : 0;

    // Add video to playlist
    const item = await PlaylistItem.create({
      playlistId: playlistId,
      videoId: videoId,
      order: nextOrder,
      duration: parseInt(duration),
    });

    // Load the item with video details
    const itemWithVideo = await PlaylistItem.findOne({
      where: { id: item.id },
      include: [{
        model: Video,
        as: 'video',
      }],
    });

    res.json({ 
      success: true, 
      message: 'Video added to playlist',
      item: itemWithVideo,
    });
  } catch (error) {
    console.error('Add video to playlist error:', error);
    res.status(500).json({ success: false, error: 'Error adding video' });
  }
});

/**
 * POST /dashboard/playlists/:playlistId/timeline/:itemId/update
 * Update a playlist item (e.g., duration)
 */
router.post('/playlists/:playlistId/timeline/:itemId/update', webRequireAuth, webRequireCompany, webCheckCompanyLicense, async (req, res) => {
  try {
    const { Playlist, PlaylistItem } = require('../models');
    const { playlistId, itemId } = req.params;
    const { duration } = req.body;

    // Validate input
    if (!duration || duration < 1) {
      return res.status(400).json({ success: false, error: 'Duration must be at least 1 second' });
    }

    // Verify playlist belongs to company
    const playlist = await Playlist.findOne({
      where: {
        id: playlistId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist not found' });
    }

    // Update the item
    const [updated] = await PlaylistItem.update(
      { duration: parseInt(duration) },
      {
        where: {
          id: itemId,
          playlistId: playlistId,
        },
      }
    );

    if (updated === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true, message: 'Video duration updated' });
  } catch (error) {
    console.error('Update playlist item error:', error);
    res.status(500).json({ success: false, error: 'Error updating video' });
  }
});

/**
 * POST /dashboard/playlists/:playlistId/timeline/:itemId/reorder
 * Reorder a playlist item
 */
router.post('/playlists/:playlistId/timeline/:itemId/reorder', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const { Playlist, PlaylistItem } = require('../models');
    const { playlistId, itemId } = req.params;
    const { newOrder } = req.body;

    // Validate input
    if (typeof newOrder !== 'number' || newOrder < 0) {
      return res.status(400).json({ success: false, error: 'Invalid order' });
    }

    // Verify playlist belongs to company
    const playlist = await Playlist.findOne({
      where: {
        id: playlistId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist not found' });
    }

    // Get all playlist items ordered by current order
    const items = await PlaylistItem.findAll({
      where: { playlistId },
      order: [['order', 'ASC']],
    });

    // Find the item to move
    const itemToMove = items.find(item => item.id === itemId);
    if (!itemToMove) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const oldOrder = itemToMove.order;
    
    // Reorder logic
    if (oldOrder !== newOrder) {
      if (oldOrder < newOrder) {
        // Moving down - shift items up
        for (const item of items) {
          if (item.order > oldOrder && item.order <= newOrder) {
            await item.update({ order: item.order - 1 });
          }
        }
      } else {
        // Moving up - shift items down
        for (const item of items) {
          if (item.order >= newOrder && item.order < oldOrder) {
            await item.update({ order: item.order + 1 });
          }
        }
      }
      
      // Update the moved item
      await itemToMove.update({ order: newOrder });
    }

    res.json({ success: true, message: 'Video reordered successfully' });
  } catch (error) {
    console.error('Reorder playlist item error:', error);
    res.status(500).json({ success: false, error: 'Error reordering video' });
  }
});

/**
 * POST /dashboard/playlists/:playlistId/timeline/:itemId/remove
 * Remove a video from playlist timeline
 */
router.post('/playlists/:playlistId/timeline/:itemId/remove', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const { Playlist, PlaylistItem } = require('../models');
    const { playlistId, itemId } = req.params;

    // Verify playlist belongs to company
    const playlist = await Playlist.findOne({
      where: {
        id: playlistId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist not found' });
    }

    // Remove the item
    const deleted = await PlaylistItem.destroy({
      where: {
        id: itemId,
        playlistId: playlistId,
      },
    });

    if (deleted === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    res.json({ success: true, message: 'Video removed from playlist' });
  } catch (error) {
    console.error('Remove video from playlist error:', error);
    res.status(500).json({ success: false, error: 'Error removing video' });
  }
});

/**
 * POST /dashboard/playlists/:playlistId/timeline/clear
 * Clear all videos from playlist timeline
 */
router.post('/playlists/:playlistId/timeline/clear', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const { Playlist, PlaylistItem } = require('../models');
    const { playlistId } = req.params;

    // Verify playlist belongs to company
    const playlist = await Playlist.findOne({
      where: {
        id: playlistId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!playlist) {
      return res.status(404).json({ success: false, error: 'Playlist not found' });
    }

    // Clear all items from playlist
    const deleted = await PlaylistItem.destroy({
      where: {
        playlistId: playlistId,
      },
    });

    res.json({ 
      success: true, 
      message: 'Playlist cleared',
      deletedCount: deleted,
    });
  } catch (error) {
    console.error('Clear playlist error:', error);
    res.status(500).json({ success: false, error: 'Error clearing playlist' });
  }
});

/**
 * POST /dashboard/playlists/:playlistId/update
 * Update an existing playlist
 */
router.post('/playlists/:playlistId/update', webRequireAuth, webRequireCompany, webCheckCompanyLicense, async (req, res) => {
  try {
    const { Playlist } = require('../models');
    const { playlistId } = req.params;
    const { name, description } = req.body;

    // Validate input
    if (!name || name.trim().length === 0) {
      return res.redirect(`/dashboard/playlists/${playlistId}/timeline?error=` + encodeURIComponent('Playlist name is required'));
    }

    // Find and update playlist
    const playlist = await Playlist.findOne({
      where: {
        id: playlistId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!playlist) {
      return res.redirect('/dashboard/playlists?error=' + encodeURIComponent('Playlist not found'));
    }

    await playlist.update({
      name: name.trim(),
      description: description?.trim() || null,
    });

    res.redirect(`/dashboard/playlists/${playlistId}/timeline?success=` + encodeURIComponent('Playlist updated successfully'));
  } catch (error) {
    console.error('Playlist update error:', error);
    res.redirect(`/dashboard/playlists/${req.params.playlistId}/timeline?error=` + encodeURIComponent('Error updating playlist'));
  }
});

/**
 * POST /dashboard/playlists/:playlistId/delete
 * Delete a playlist
 */
router.post('/playlists/:playlistId/delete', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const { Playlist, PlaylistItem } = require('../models');
    const { playlistId } = req.params;

    // Find playlist
    const playlist = await Playlist.findOne({
      where: {
        id: playlistId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!playlist) {
      return res.redirect('/dashboard/playlists?error=' + encodeURIComponent('Playlist not found'));
    }

    // Delete all playlist items first
    await PlaylistItem.destroy({
      where: { playlistId: playlistId },
    });

    // Delete playlist
    await playlist.update({ isActive: false });

    res.redirect('/dashboard/playlists?success=' + encodeURIComponent('Playlist deleted successfully'));
  } catch (error) {
    console.error('Playlist deletion error:', error);
    res.redirect('/dashboard/playlists?error=' + encodeURIComponent('Error deleting playlist'));
  }
});

/**
 * POST /dashboard/upload
 * DEPRECATED - This endpoint has been removed
 * The dashboard now uses direct S3 upload via JavaScript
 * See dashboard.ejs for the client-side implementation
 */
router.post('/upload', webRequireAuth, webRequireCompany, async (req, res) => {
  return res.redirect(`/dashboard/media?error=${encodeURIComponent('This upload method has been deprecated. Please use the upload button on the page which uploads directly to S3.')}`);
});

/**
 * POST /dashboard/media/:videoId/edit
 * Edit video name
 */
router.post('/media/:videoId/edit', webRequireAuth, webRequireCompany, webCheckCompanyLicense, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { fileName } = req.body;

    if (!fileName || !fileName.trim()) {
      return res.redirect(`/dashboard/media?error=${encodeURIComponent('Video name cannot be empty')}`);
    }

    const video = await Video.findOne({
      where: {
        id: videoId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!video) {
      return res.redirect(`/dashboard/media?error=${encodeURIComponent('Video not found')}`);
    }

    // Check if user has permission to edit
    const canEdit = 
      video.uploadedBy === req.user.id ||
      ['owner', 'admin', 'manager'].includes(req.userCompany.role);

    if (!canEdit) {
      return res.redirect(`/dashboard/media?error=${encodeURIComponent('You do not have permission to edit this video')}`);
    }

    // Update video name
    await video.update({ fileName: fileName.trim() });

    res.redirect(`/dashboard/media?success=${encodeURIComponent('Video name updated successfully!')}`);
  } catch (error) {
    console.error('Video edit error:', error);
    res.redirect(`/dashboard/media?error=${encodeURIComponent('Update failed: ' + error.message)}`);
  }
});

/**
 * POST /dashboard/media/:videoId/delete
 * Delete a single video
 */
router.post('/media/:videoId/delete', webRequireAuth, webRequireCompany, async (req, res) => {
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
      return res.redirect(`/dashboard/media?error=${encodeURIComponent('Video not found')}`);
    }

    // Check if user has permission to delete
    const canDelete = 
      video.uploadedBy === req.user.id ||
      ['owner', 'admin', 'manager'].includes(req.userCompany.role);

    if (!canDelete) {
      return res.redirect(`/dashboard/media?error=${encodeURIComponent('You do not have permission to delete this video')}`);
    }

    // ATOMIC DELETE OPERATION
    const transaction = await sequelize.transaction();
    
    try {
      // Step 1: Delete from S3 first
      const fileDeleted = await deleteFromS3(video.filePath);
      if (!fileDeleted) {
        throw new Error('Failed to delete video from S3');
      }

      // Step 2: Delete thumbnail if exists
      if (video.thumbnailPath) {
        try {
          await deleteFromS3(video.thumbnailPath);
        } catch (thumbError) {
          console.warn('⚠️  Thumbnail delete failed, continuing');
        }
      }

      // Step 3: Delete from database (within transaction)
      await video.destroy({ force: true, transaction });

      // Step 4: Update company storage usage (within transaction)
      await Company.decrement('storageUsedBytes', {
        by: video.fileSize,
        where: { id: req.company.id },
        transaction,
      });

      // Commit transaction
      await transaction.commit();

      res.redirect(`/dashboard/media?success=${encodeURIComponent('Video deleted successfully!')}`);
    } catch (error) {
      // Rollback transaction
      await transaction.rollback();
      console.error('Delete operation failed:', error);
      
      res.redirect(`/dashboard/media?error=${encodeURIComponent('Failed to delete video: ' + error.message)}`);
    }
  } catch (error) {
    console.error('Video delete error:', error);
    res.redirect(`/dashboard/media?error=${encodeURIComponent('Delete failed: ' + error.message)}`);
  }
});

/**
 * POST /dashboard/media/bulk-delete
 * Delete multiple videos
 */
router.post('/media/bulk-delete', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    const videoIds = req.body['videoIds[]'] || req.body.videoIds || [];
    const idsArray = Array.isArray(videoIds) ? videoIds : [videoIds];

    if (idsArray.length === 0) {
      return res.redirect(`/dashboard/media?error=${encodeURIComponent('No videos selected')}`);
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

          // Delete from database
          await video.destroy({ force: true, transaction: videoTransaction });

          // Update company storage usage (within transaction)
          await Company.decrement('storageUsedBytes', {
            by: video.fileSize,
            where: { id: req.company.id },
            transaction: videoTransaction,
          });

          // Commit transaction
          await videoTransaction.commit();

          deleted++;
        } catch (error) {
          // Rollback transaction
          await videoTransaction.rollback();
          console.error(`Error deleting video ${video.id}:`, error);
          failed++;
        }
      } catch (error) {
        console.error(`Error deleting video ${video.id}:`, error);
        failed++;
      }
    }

    const message = `Successfully deleted ${deleted} video(s)` + 
                   (failed > 0 ? `. ${failed} video(s) could not be deleted.` : '');

    res.redirect(`/dashboard/media?success=${encodeURIComponent(message)}`);
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.redirect(`/dashboard?tab=uploads&error=${encodeURIComponent('Bulk delete failed: ' + error.message)}`);
  }
});

/**
 * GET /dashboard/users
 * User management page for company owners/admins
 */
router.get('/users', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    // Check if user has permission (owner or admin)
    if (!['owner', 'admin'].includes(req.userCompany.role)) {
      return res.status(403).render('error', {
        message: 'Access Denied',
        details: 'Only company owners and admins can manage users',
        user: req.user,
        company: req.company,
        userCompany: req.userCompany,
        session: req.session,
      });
    }

    // Load all users in this company
    const userCompanies = await UserCompany.findAll({
      where: {
        companyId: req.company.id,
        isActive: true,
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'firstName', 'lastName', 'phoneNumber', 'isActive', 'createdAt', 'lastLoginAt'],
      }],
      order: [['joinedAt', 'DESC']],
    });

    // Format user data
    const users = userCompanies.map(uc => ({
      id: uc.user.id,
      email: uc.user.email,
      firstName: uc.user.firstName,
      lastName: uc.user.lastName,
      phoneNumber: uc.user.phoneNumber,
      role: uc.role,
      isActive: uc.user.isActive,
      joinedAt: uc.joinedAt,
      lastLoginAt: uc.user.lastLoginAt,
      createdAt: uc.user.createdAt,
    }));

    res.render('users-management', {
      title: 'User Management',
      user: req.user,
      company: req.company,
      userCompany: req.userCompany,
      session: req.session,
      users: users,
    });
  } catch (error) {
    console.error('User management page error:', error);
    res.status(500).send('Error loading user management');
  }
});

/**
 * POST /dashboard/users/create
 * Create a new user and add to the company (owner/admin only)
 */
router.post('/users/create', webRequireAuth, webRequireCompany, webCheckCompanyLicense, async (req, res) => {
  try {
    // Check if user has permission
    if (!['owner', 'admin'].includes(req.userCompany.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only company owners and admins can create users' 
      });
    }

    const { email, password, firstName, lastName, phoneNumber, role } = req.body;

    // Validate role
    const validRoles = ['admin', 'manager', 'member', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, manager, member, or viewer',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      where: { email: email.toLowerCase() } 
    });

    if (existingUser) {
      // Check if user is already in this company
      const existingMembership = await UserCompany.findOne({
        where: {
          userId: existingUser.id,
          companyId: req.company.id,
        },
      });

      if (existingMembership) {
        return res.status(409).json({
          success: false,
          message: 'User is already a member of this company',
        });
      }

      // Add existing user to company
      await UserCompany.create({
        userId: existingUser.id,
        companyId: req.company.id,
        role: role || 'member',
        isActive: true,
        joinedAt: new Date(),
      });

      return res.json({
        success: true,
        message: 'User added to company successfully',
      });
    }

    // Create new user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      phoneNumber: phoneNumber || null,
    });

    // Add to company
    await UserCompany.create({
      userId: user.id,
      companyId: req.company.id,
      role: role || 'member',
      isActive: true,
      joinedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'User created and added to company successfully',
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating user: ' + error.message 
    });
  }
});

/**
 * POST /dashboard/users/:userId/update
 * Update a user's details in the company (owner/admin only)
 */
router.post('/users/:userId/update', webRequireAuth, webRequireCompany, webCheckCompanyLicense, async (req, res) => {
  try {
    // Check if user has permission
    if (!['owner', 'admin'].includes(req.userCompany.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only company owners and admins can update users' 
      });
    }

    const { userId } = req.params;
    const { firstName, lastName, email, phoneNumber, password, role } = req.body;

    // Prevent self-demotion
    if (userId === req.user.id && role && role !== req.userCompany.role) {
      return res.status(403).json({
        success: false,
        message: 'You cannot change your own role',
      });
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user is in this company
    const membership = await UserCompany.findOne({
      where: {
        userId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!membership) {
      return res.status(404).json({ 
        success: false, 
        message: 'User is not a member of this company' 
      });
    }

    // Update user details
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email && email.toLowerCase() !== user.email) {
      // Check if email is already taken
      const existingUser = await User.findOne({
        where: { email: email.toLowerCase() },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use',
        });
      }
      updateData.email = email.toLowerCase();
    }
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (password && password.trim().length > 0) updateData.password = password;

    if (Object.keys(updateData).length > 0) {
      await user.update(updateData);
    }

    // Update role if provided
    if (role && role !== membership.role) {
      const validRoles = ['admin', 'manager', 'member', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role',
        });
      }

      // Only owners can assign admin role
      if (role === 'admin' && req.userCompany.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Only company owners can assign admin role',
        });
      }

      await membership.update({ role });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating user: ' + error.message 
    });
  }
});

/**
 * POST /dashboard/users/:userId/remove
 * Remove a user from the company (owner/admin only)
 */
router.post('/users/:userId/remove', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    // Check if user has permission
    if (!['owner', 'admin'].includes(req.userCompany.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only company owners and admins can remove users' 
      });
    }

    const { userId } = req.params;

    // Prevent self-removal
    if (userId === req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You cannot remove yourself from the company',
      });
    }

    // Find membership
    const membership = await UserCompany.findOne({
      where: {
        userId,
        companyId: req.company.id,
        isActive: true,
      },
    });

    if (!membership) {
      return res.status(404).json({ 
        success: false, 
        message: 'User is not a member of this company' 
      });
    }

    // Soft delete membership
    await membership.update({ isActive: false });

    res.json({
      success: true,
      message: 'User removed from company successfully',
    });
  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error removing user: ' + error.message 
    });
  }
});

/**
 * GET /dashboard/license
 * Display license details for the company
 */
router.get('/license', webRequireAuth, webRequireCompany, async (req, res) => {
  try {
    // Find active license for this company
    const activeLicense = await License.findOne({
      where: {
        companyId: req.company.id,
        isActive: true,
      },
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'email', 'firstName', 'lastName'],
      }],
    });

    // Find all licenses for this company (including inactive ones for history)
    const allLicenses = await License.findAll({
      where: {
        companyId: req.company.id,
      },
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'email', 'firstName', 'lastName'],
      }],
      order: [['createdAt', 'DESC']],
    });

    // Count current active users in the company
    const activeUsersCount = await UserCompany.count({
      where: {
        companyId: req.company.id,
        isActive: true,
      },
    });

    // Get storage usage
    const storageUsed = req.company.storageUsedBytes || 0;
    const storageLimit = activeLicense?.maxStorageBytes || 524288000; // 500MB default

    // Calculate license status
    let licenseStatus = 'no_license';
    let daysRemaining = 0;
    let isExpired = false;
    
    if (activeLicense) {
      const now = new Date();
      const expiryDate = new Date(activeLicense.expiresAt);
      const diffTime = expiryDate - now;
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (daysRemaining < 0) {
        licenseStatus = 'expired';
        isExpired = true;
      } else if (daysRemaining <= 7) {
        licenseStatus = 'expiring_soon';
      } else {
        licenseStatus = 'active';
      }
    }

    res.render('license-details', {
      title: 'License Details',
      user: req.user,
      company: req.company,
      userCompany: req.userCompany,
      session: req.session,
      activeLicense: activeLicense,
      allLicenses: allLicenses,
      activeUsersCount: activeUsersCount,
      storageUsed: storageUsed,
      storageLimit: storageLimit,
      licenseStatus: licenseStatus,
      daysRemaining: daysRemaining,
      isExpired: isExpired,
    });
  } catch (error) {
    console.error('License details error:', error);
    res.status(500).send('Error loading license details');
  }
});

module.exports = router;

