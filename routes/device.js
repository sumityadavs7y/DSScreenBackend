const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const QRCode = require('qrcode');
const { RegistrationSession, Device, Playlist, DevicePlaylist } = require('../models');
const { Op } = require('sequelize');
const { envConfig } = require('../config');
const sessionCleanupService = require('../services/sessionCleanupService');

/**
 * POST /api/device/init-registration
 * Initialize a new registration session for a device
 * Returns session token and QR code data
 */
router.post('/init-registration', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required',
      });
    }

    // Cancel any existing pending sessions for this device
    await RegistrationSession.update(
      { status: 'cancelled' },
      {
        where: {
          deviceId,
          status: 'pending',
        },
      }
    );

    // Generate session token
    const sessionToken = crypto.randomUUID();

    // Session expires in 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Create registration session
    const session = await RegistrationSession.create({
      sessionToken,
      deviceId,
      status: 'pending',
      expiresAt,
    });

    // Generate QR code URL
    const baseUrl = envConfig.baseUrl || `http://localhost:${envConfig.port}`;
    const registrationUrl = `${baseUrl}/device-register.html?session=${sessionToken}`;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(registrationUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    console.log(`✅ Registration session created for device: ${deviceId}`);
    console.log(`📱 Session token: ${sessionToken}`);
    console.log(`🔗 Registration URL: ${registrationUrl}`);

    res.json({
      success: true,
      message: 'Registration session created',
      data: {
        sessionToken,
        qrCodeDataUrl,
        registrationUrl,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('❌ Error creating registration session:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating registration session',
      error: error.message,
    });
  }
});

/**
 * GET /api/device/register/:sessionToken
 * Get registration session info (for mobile page)
 */
router.get('/register/:sessionToken', async (req, res) => {
  try {
    const { sessionToken } = req.params;

    const session = await RegistrationSession.findOne({
      where: {
        sessionToken,
        status: 'pending',
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Registration session not found or expired',
      });
    }

    res.json({
      success: true,
      data: {
        sessionToken: session.sessionToken,
        deviceId: session.deviceId,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching registration session:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching registration session',
      error: error.message,
    });
  }
});

/**
 * POST /api/device/register/:sessionToken
 * Complete device registration by submitting code
 */
router.post('/register/:sessionToken', async (req, res) => {
  try {
    const { sessionToken } = req.params;
    const { code } = req.body;

    if (!code || code.length !== 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid code. Code must be exactly 5 characters.',
      });
    }

    // Find the session
    const session = await RegistrationSession.findOne({
      where: {
        sessionToken,
        status: 'pending',
        expiresAt: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Registration session not found or expired',
      });
    }

    // Find the playlist by code (case-insensitive search)
    const playlist = await Playlist.findOne({
      where: {
        code: {
          [Op.iLike]: code // Case-insensitive search (works with both upper/lower)
        },
        isActive: true,
      },
    });

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Invalid code. No active playlist found with this code.',
      });
    }

    // Find or create device
    let device = await Device.findOne({
      where: { uid: session.deviceId },
    });

    if (device) {
      // Update existing device
      await device.update({
        lastSeen: new Date(),
        isActive: true,
      });
    } else {
      // Create new device
      device = await Device.create({
        uid: session.deviceId,
        deviceInfo: {},
        lastSeen: new Date(),
        isActive: true,
      });
    }

    // Create or update device-playlist association
    let devicePlaylist = await DevicePlaylist.findOne({
      where: {
        deviceId: device.id,
        playlistId: playlist.id,
      },
    });

    if (devicePlaylist) {
      await devicePlaylist.update({
        registeredAt: new Date(),
        isActive: true,
      });
    } else {
      devicePlaylist = await DevicePlaylist.create({
        deviceId: device.id,
        playlistId: playlist.id,
        registeredAt: new Date(),
        isActive: true,
      });
    }

    // Update session
    await session.update({
      status: 'completed',
      registrationCode: code.toUpperCase(),
    });

    console.log(`✅ Device ${session.deviceId} registered with code: ${code}`);

    // Fetch full playlist with items for Socket.IO notification
    const fullPlaylist = await Playlist.findOne({
      where: {
        id: playlist.id,
      },
      include: [
        {
          model: require('../models').PlaylistItem,
          as: 'items',
          required: false,
          include: [
            {
              model: require('../models').Video,
              as: 'video',
              where: { isActive: true },
              required: false,
              attributes: ['id', 'fileName', 'filePath', 'thumbnailPath', 'fileSize', 'mimeType', 'duration', 'resolution'],
            },
          ],
        },
      ],
      order: [[{ model: require('../models').PlaylistItem, as: 'items' }, 'order', 'ASC']],
    });

    // Notify device via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`device:${session.deviceId}`).emit('registration:complete', {
        success: true,
        device: {
          id: device.id,
          uid: device.uid,
        },
        playlist: {
          id: fullPlaylist.id,
          name: fullPlaylist.name,
          description: fullPlaylist.description,
          code: fullPlaylist.code,
          items: fullPlaylist.items || [],
        },
      });
      console.log(`📢 Socket notification sent to device:${session.deviceId} with ${fullPlaylist.items?.length || 0} items`);
    }

    res.json({
      success: true,
      message: 'Device registered successfully',
      data: {
        device: {
          id: device.id,
          uid: device.uid,
        },
        playlist: {
          id: playlist.id,
          name: playlist.name,
          code: playlist.code,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error completing registration:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing registration',
      error: error.message,
    });
  }
});

/**
 * GET /api/device/check-session/:sessionToken
 * Check if registration session is still valid
 */
router.get('/check-session/:sessionToken', async (req, res) => {
  try {
    const { sessionToken } = req.params;

    const session = await RegistrationSession.findOne({
      where: {
        sessionToken,
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    const isExpired = new Date(session.expiresAt) < new Date();
    const isValid = session.status === 'pending' && !isExpired;

    res.json({
      success: true,
      data: {
        status: session.status,
        isValid,
        isExpired,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error('❌ Error checking session:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking session',
      error: error.message,
    });
  }
});

/**
 * GET /api/device/cleanup-stats
 * Get session cleanup service statistics
 */
router.get('/cleanup-stats', (req, res) => {
  try {
    const stats = sessionCleanupService.getStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('❌ Error getting cleanup stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting cleanup stats',
      error: error.message,
    });
  }
});

module.exports = router;

