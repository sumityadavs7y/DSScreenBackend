const express = require('express');
const path = require('path');
const router = express.Router();

// Note: Login, register, company-selection, and dashboard routes are handled by web.js and dashboard.js
// This file only contains API routes and device-specific pages

// API info endpoint (for developers)
router.get('/api', (req, res) => {
    res.json({
        status: 'success',
        message: 'Digital Signage Backend API - by Logical Valley Infotech',
        version: '1.0.0',
        documentation: {
            authentication: 'See AUTHENTICATION.md for detailed auth documentation',
            quickstart: 'See QUICKSTART.md for setup instructions'
        },
        endpoints: {
            health: '/health',
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                selectCompany: 'POST /api/auth/select-company (requires tempToken)',
                logout: 'POST /api/auth/logout (requires accessToken)',
                me: 'GET /api/auth/me (requires accessToken)',
                companies: 'GET /api/auth/companies (requires accessToken)',
                switchCompany: 'POST /api/auth/switch-company (requires accessToken)',
                refresh: 'POST /api/auth/refresh (requires refreshToken)'
            },
            company: {
                info: 'GET /api/company/info (requires accessToken)',
                updateInfo: 'PUT /api/company/info (requires accessToken, owner/admin)',
                members: 'GET /api/company/members (requires accessToken)',
                addMember: 'POST /api/company/members/add (requires accessToken, owner/admin)',
                addMemberById: 'POST /api/company/members/add-by-id (requires accessToken, owner/admin)',
                updateRole: 'PUT /api/company/members/:userId/role (requires accessToken, owner/admin)',
                updatePermissions: 'PUT /api/company/members/:userId/permissions (requires accessToken, owner/admin)',
                removeMember: 'DELETE /api/company/members/:userId (requires accessToken, owner/admin)'
            },
            users: {
                create: 'POST /api/users/create (requires accessToken, owner/admin) - Create user and optionally add to company',
                search: 'GET /api/users/search?email=query (requires accessToken, owner/admin) - Search users by email'
            }
        },
        authFlow: {
            step1: 'Register or Login → Get tempToken + list of companies',
            step2: 'Select Company → Get accessToken + refreshToken',
            step3: 'Use accessToken in Authorization header for all API calls',
            note: 'Company context is securely embedded in the JWT token'
        }
    });
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Video demo page
router.get('/demo/video', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/video-demo.html'));
});

// Favicon handler (prevent 404)
router.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

/**
 * POST /playlists/device/register
 * Register a device to a playlist using the playlist code
 * PUBLIC ENDPOINT - No authentication required
 * Creates or updates device registration and returns playlist details
 */
router.post('/playlists/device/register', async (req, res) => {
  console.log('🔥 Device registration endpoint hit!', req.body);
  try {
    const { Playlist, PlaylistItem, Video, Device, DevicePlaylist, Company, License } = require('../models');
    const { playlistCode, uid, deviceInfo } = req.body;

    // Validate inputs
    if (!playlistCode || playlistCode.length !== 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid playlist code. Code must be exactly 5 characters.',
      });
    }

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'Device UID is required',
      });
    }

    // Use the code as-is (case-sensitive)
    console.log(`🔍 Searching for playlist with code: "${playlistCode}"`);

    // Find playlist by code with company
    const playlist = await Playlist.findOne({
      where: {
        code: playlistCode,
        isActive: true,
      },
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name', 'isActive'],
        },
        {
          model: PlaylistItem,
          as: 'items',
          required: false,
          include: [
            {
              model: Video,
              as: 'video',
              where: { isActive: true },
              required: false,
              attributes: ['id', 'fileName', 'filePath', 'thumbnailPath', 'fileSize', 'mimeType', 'duration', 'resolution'],
            },
          ],
        },
      ],
      order: [[{ model: PlaylistItem, as: 'items' }, 'order', 'ASC']],
    });

    console.log('✅ Playlist found:', playlist ? playlist.id : 'NOT FOUND');

    if (!playlist) {
      // Show all available playlist codes for debugging
      const allPlaylists = await Playlist.findAll({
        where: { isActive: true }, 
        attributes: ['code', 'name', 'id'] 
      });
      console.log('❌ Playlist not found with code:', playlistCode);
      console.log('📋 Available playlist codes:', allPlaylists.map(p => `${p.code} (${p.name})`).join(', ') || 'NONE');
      
      return res.status(404).json({
        success: false,
        message: 'Playlist not found or inactive',
      });
    }

    // Check if the company has a valid license
    const activeLicense = await License.findOne({
      where: {
        companyId: playlist.companyId,
        isActive: true,
      },
    });

    if (!activeLicense) {
      console.log('❌ No active license found for company:', playlist.companyId);
      return res.status(403).json({
        success: false,
        message: 'This company does not have an active license. Device registration is not allowed.',
      });
    }

    // Check if license is expired
    const now = new Date();
    const expiryDate = new Date(activeLicense.expiresAt);
    if (expiryDate < now) {
      console.log('❌ License expired for company:', playlist.companyId);
      return res.status(403).json({
        success: false,
        message: 'This company\'s license has expired. Device registration is not allowed.',
      });
    }

    console.log('✅ Valid license found for company:', playlist.companyId);

    // Find or create device
    let device = await Device.findOne({
      where: { uid },
    });

    if (device) {
      // Update existing device
      await device.update({
        deviceInfo: deviceInfo || device.deviceInfo,
        lastSeen: new Date(),
        isActive: true,
      });
    } else {
      // Create new device
      device = await Device.create({
        uid,
        deviceInfo: deviceInfo || {},
        lastSeen: new Date(),
        isActive: true,
      });
    }

    // Find or create device-playlist association
    let devicePlaylist = await DevicePlaylist.findOne({
      where: {
        deviceId: device.id,
        playlistId: playlist.id,
      },
    });

    if (devicePlaylist) {
      // Update existing association
      await devicePlaylist.update({
        registeredAt: new Date(),
        isActive: true,
      });
    } else {
      // Create new association
      devicePlaylist = await DevicePlaylist.create({
        deviceId: device.id,
        playlistId: playlist.id,
        registeredAt: new Date(),
        isActive: true,
      });
    }

    console.log('✅ Sending success response');
    console.log('📋 Playlist items count:', playlist.items?.length || 0);
    if (playlist.items && playlist.items.length > 0) {
      console.log('📹 First item video data:', {
        fileName: playlist.items[0].video?.fileName,
        filePath: playlist.items[0].video?.filePath,
        hasVideo: !!playlist.items[0].video,
      });
    }
    
    res.json({
      success: true,
      message: 'Device registered successfully',
      data: {
        device: {
          id: device.id,
          uid: device.uid,
          lastSeen: device.lastSeen,
        },
        playlist: {
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          code: playlist.code,
          items: playlist.items,
        },
      },
    });
    console.log('✅ Response sent successfully');
  } catch (error) {
    console.error('❌ Device registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering device',
      error: error.message,
    });
  }
});

/**
 * GET /api/playlists/:playlistId/timeline
 * Get playlist timeline with video details
 * PUBLIC ENDPOINT - No authentication required
 */
router.get('/api/playlists/:playlistId/timeline', async (req, res) => {
  try {
    const { Playlist, PlaylistItem, Video } = require('../models');
    const { playlistId } = req.params;

    console.log('📋 Fetching timeline for playlist:', playlistId);

    // Find the playlist with items
    const playlist = await Playlist.findOne({
      where: {
        id: playlistId,
        isActive: true,
      },
      include: [{
        model: PlaylistItem,
        as: 'items',
        required: false,
        include: [{
          model: Video,
          as: 'video',
          where: { isActive: true },
          required: false,
          attributes: ['id', 'fileName', 'filePath', 'mimeType', 'duration', 'fileSize'],
        }],
      }],
      order: [[{ model: PlaylistItem, as: 'items' }, 'order', 'ASC']],
    });

    if (!playlist) {
      console.log('❌ Playlist not found');
      return res.status(404).json({
        success: false,
        message: 'Playlist not found',
      });
    }

    console.log('✅ Found playlist with', playlist.items?.length || 0, 'items');

    res.json({
      success: true,
      data: playlist.items || [],
    });

  } catch (error) {
    console.error('❌ Error fetching timeline:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching timeline',
      error: error.message,
    });
  }
});

module.exports = router;

