/**
 * Super Admin Routes
 * System-wide management for companies, users, videos, and playlists
 */

const express = require('express');
const router = express.Router();
const { User, Company, UserCompany, Video, Playlist, PlaylistItem, Device } = require('../models');
const { webRequireAuth } = require('../middleware/sessionAuth');
const { webRequireSuperAdmin } = require('../middleware/superAdminAuth');

// Apply authentication middleware to all admin routes
router.use(webRequireAuth);
router.use(webRequireSuperAdmin);

/**
 * GET /admin
 * Super Admin Dashboard - Overview of entire system
 */
router.get('/', async (req, res) => {
  try {
    // Get system-wide statistics
    const stats = {
      totalCompanies: await Company.count({ where: { isActive: true } }),
      totalUsers: await User.count({ where: { isActive: true } }),
      totalVideos: await Video.count({ where: { isActive: true } }),
      totalPlaylists: await Playlist.count({ where: { isActive: true } }),
      totalDevices: await Device.count({ where: { isActive: true } }),
    };

    // Get recent activity
    const recentCompanies = await Company.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
      limit: 5,
    });

    const recentUsers = await User.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'email', 'firstName', 'lastName', 'createdAt'],
    });

    res.render('admin/dashboard', {
      title: 'Super Admin Dashboard',
      user: req.user,
      stats,
      recentCompanies,
      recentUsers,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).send('Error loading admin dashboard');
  }
});

/**
 * GET /admin/companies
 * List all companies in the system
 */
router.get('/companies', async (req, res) => {
  try {
    const companies = await Company.findAll({
      where: { isActive: true },
      include: [
        {
          model: UserCompany,
          as: 'companyUsers',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'email', 'firstName', 'lastName'],
            }
          ],
        },
        {
          model: Video,
          as: 'videos',
          attributes: ['id'],
          required: false,
        },
        {
          model: Playlist,
          as: 'playlists',
          attributes: ['id'],
          required: false,
        }
      ],
      order: [['createdAt', 'DESC']],
    });

    const companiesData = companies.map(c => c.toJSON());

    res.render('admin/companies', {
      title: 'Manage Companies',
      user: req.user,
      companies: companiesData,
    });
  } catch (error) {
    console.error('Admin companies error:', error);
    res.status(500).send('Error loading companies');
  }
});

/**
 * GET /admin/companies/:companyId
 * View detailed company information
 */
router.get('/companies/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findByPk(companyId, {
      include: [
        {
          model: UserCompany,
          as: 'companyUsers',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'email', 'firstName', 'lastName', 'isActive', 'createdAt'],
            }
          ],
        },
        {
          model: Video,
          as: 'videos',
          required: false,
        },
        {
          model: Playlist,
          as: 'playlists',
          include: [
            {
              model: PlaylistItem,
              as: 'items',
              attributes: ['id'],
            }
          ],
          required: false,
        }
      ],
    });

    if (!company) {
      return res.status(404).send('Company not found');
    }

    res.render('admin/company-detail', {
      title: `Company: ${company.name}`,
      user: req.user,
      company: company.toJSON(),
    });
  } catch (error) {
    console.error('Admin company detail error:', error);
    res.status(500).send('Error loading company details');
  }
});

/**
 * GET /admin/users
 * List all users in the system
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      where: { isActive: true },
      include: [
        {
          model: UserCompany,
          as: 'userCompanies',
          include: [
            {
              model: Company,
              as: 'company',
              attributes: ['id', 'name', 'slug'],
            }
          ],
        }
      ],
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] },
    });

    const usersData = users.map(u => u.toJSON());

    res.render('admin/users', {
      title: 'Manage Users',
      user: req.user,
      users: usersData,
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).send('Error loading users');
  }
});

/**
 * GET /admin/videos
 * List all videos across all companies
 */
router.get('/videos', async (req, res) => {
  try {
    const videos = await Video.findAll({
      where: { isActive: true },
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        }
      ],
      order: [['createdAt', 'DESC']],
    });

    const videosData = videos.map(v => v.toJSON());

    res.render('admin/videos', {
      title: 'Manage Videos',
      user: req.user,
      videos: videosData,
    });
  } catch (error) {
    console.error('Admin videos error:', error);
    res.status(500).send('Error loading videos');
  }
});

/**
 * GET /admin/playlists
 * List all playlists across all companies
 */
router.get('/playlists', async (req, res) => {
  try {
    const playlists = await Playlist.findAll({
      where: { isActive: true },
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name', 'slug'],
        },
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

    const playlistsData = playlists.map(p => p.toJSON());

    res.render('admin/playlists', {
      title: 'Manage Playlists',
      user: req.user,
      playlists: playlistsData,
    });
  } catch (error) {
    console.error('Admin playlists error:', error);
    res.status(500).send('Error loading playlists');
  }
});

/**
 * POST /admin/users/:userId/toggle-super-admin
 * Toggle super admin status for a user
 */
router.post('/users/:userId/toggle-super-admin', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Prevent users from revoking their own super admin status
    // Check both req.user.id and req.session.userId for redundancy
    const currentUserId = req.user?.id || req.session?.userId;
    
    console.log('Toggle Super Admin Request:', {
      targetUserId: userId,
      currentUserId: currentUserId,
      isSelf: userId === currentUserId
    });
    
    if (userId === currentUserId) {
      console.log('⚠️ Blocked: User attempted to revoke their own super admin privileges');
      return res.status(403).json({ 
        success: false, 
        message: 'You cannot revoke your own super admin privileges' 
      });
    }
    
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Additional check: if user is currently a super admin and we're trying to revoke
    if (user.isSuperAdmin && userId === currentUserId) {
      console.log('⚠️ Double-check blocked: User attempted to revoke their own super admin privileges');
      return res.status(403).json({ 
        success: false, 
        message: 'You cannot revoke your own super admin privileges' 
      });
    }

    // Toggle super admin status
    const previousStatus = user.isSuperAdmin;
    await user.update({
      isSuperAdmin: !user.isSuperAdmin,
    });

    console.log(`✅ Super admin status ${user.isSuperAdmin ? 'granted to' : 'revoked from'} ${user.email}`);

    res.json({
      success: true,
      message: `Super admin status ${user.isSuperAdmin ? 'granted' : 'revoked'} for ${user.email}`,
      isSuperAdmin: user.isSuperAdmin,
    });
  } catch (error) {
    console.error('Toggle super admin error:', error);
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
});

/**
 * POST /admin/companies/:companyId/toggle-active
 * Activate/deactivate a company
 */
router.post('/companies/:companyId/toggle-active', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const company = await Company.findByPk(companyId);
    
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    await company.update({
      isActive: !company.isActive,
    });

    res.json({
      success: true,
      message: `Company ${company.isActive ? 'activated' : 'deactivated'}`,
      isActive: company.isActive,
    });
  } catch (error) {
    console.error('Toggle company active error:', error);
    res.status(500).json({ success: false, message: 'Error updating company' });
  }
});

/**
 * DELETE /admin/videos/:videoId
 * Delete a video from any company
 */
router.delete('/videos/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const video = await Video.findByPk(videoId);
    
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    // Soft delete
    await video.update({ isActive: false });

    res.json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ success: false, message: 'Error deleting video' });
  }
});

/**
 * DELETE /admin/playlists/:playlistId
 * Delete a playlist from any company
 */
router.delete('/playlists/:playlistId', async (req, res) => {
  try {
    const { playlistId } = req.params;
    
    const playlist = await Playlist.findByPk(playlistId);
    
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Playlist not found' });
    }

    // Soft delete
    await playlist.update({ isActive: false });

    res.json({
      success: true,
      message: 'Playlist deleted successfully',
    });
  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(500).json({ success: false, message: 'Error deleting playlist' });
  }
});

module.exports = router;


