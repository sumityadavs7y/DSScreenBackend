/**
 * Admin Device Management Routes
 * Handles device listing and management for Super Admins, Owners, Admins, and Managers
 */

const express = require('express');
const router = express.Router();
const { Device, DevicePlaylist, Playlist, Company, UserCompany } = require('../models');
const { Op } = require('sequelize');
const { webRequireAuth } = require('../middleware/sessionAuth');

// Apply authentication middleware to all device management routes
router.use(webRequireAuth);

/**
 * GET /admin/devices
 * Show device management page
 * Access: Super Admin (all devices), Owner/Admin/Manager (company devices only)
 */
router.get('/devices', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }

    const { User } = require('../models');
    const user = await User.findByPk(req.session.userId);

    if (!user) {
      return res.redirect('/login');
    }

    let devices = [];
    let companies = [];
    let company = null;
    let userCompany = null;

    // Get company context if user is not a non-impersonating super admin
    if (!user.isSuperAdmin || req.session.impersonating) {
      // Company users need a company context
      if (!req.session.companyId) {
        return res.redirect('/company-selection');
      }

      company = await Company.findByPk(req.session.companyId);
      if (!company || !company.isActive) {
        delete req.session.companyId;
        delete req.session.role;
        return res.redirect('/company-selection');
      }

      // Skip UserCompany check if super admin is impersonating
      if (!req.session.impersonating || !req.session.originalSuperAdminId) {
        userCompany = await UserCompany.findOne({
          where: {
            userId: user.id,
            companyId: company.id,
            isActive: true,
          },
        });

        if (!userCompany) {
          delete req.session.companyId;
          delete req.session.role;
          return res.redirect('/company-selection');
        }
      } else {
        // For impersonating super admins, create a virtual userCompany with owner role
        userCompany = {
          role: 'owner',
          isSuperAdminAccess: true,
        };
      }
    }

    // Super Admin can see all devices
    if (user.isSuperAdmin && !req.session.impersonating) {
      devices = await Device.findAll({
        include: [
          {
            model: DevicePlaylist,
            as: 'devicePlaylists',
            include: [
              {
                model: Playlist,
                as: 'playlist',
                include: [
                  {
                    model: Company,
                    as: 'company',
                    attributes: ['id', 'name', 'slug'],
                  },
                ],
              },
            ],
          },
        ],
        order: [['lastSeen', 'DESC']],
      });

      companies = await Company.findAll({
        where: { isActive: true },
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
      });
    } else {
      // Owner/Admin/Manager can see devices in their companies
      let companyIds = [];

      // If super admin is impersonating, use the current company ID
      if (req.session.impersonating && req.session.originalSuperAdminId && req.session.companyId) {
        companyIds = [req.session.companyId];
      } else {
        // For regular company users, get their associated companies
        const userCompanies = await UserCompany.findAll({
          where: {
            userId: user.id,
            isActive: true,
            role: {
              [Op.in]: ['owner', 'admin', 'manager'],
            },
          },
        });

        if (userCompanies.length === 0) {
          return res.status(403).render('error', {
            title: 'Access Denied',
            message: 'You do not have permission to manage devices.',
          });
        }

        companyIds = userCompanies.map((uc) => uc.companyId);
      }

      // Get devices for user's companies
      devices = await Device.findAll({
        include: [
          {
            model: DevicePlaylist,
            as: 'devicePlaylists',
            required: true,
            include: [
              {
                model: Playlist,
                as: 'playlist',
                required: true,
                where: {
                  companyId: {
                    [Op.in]: companyIds,
                  },
                },
                include: [
                  {
                    model: Company,
                    as: 'company',
                    attributes: ['id', 'name', 'slug'],
                  },
                ],
              },
            ],
          },
        ],
        order: [['lastSeen', 'DESC']],
      });

      companies = await Company.findAll({
        where: {
          id: {
            [Op.in]: companyIds,
          },
          isActive: true,
        },
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
      });
    }

    // Calculate online status for each device
    const now = new Date();
    const devicesWithStatus = devices.map((device) => {
      const deviceData = device.toJSON();
      
      // Consider device online if last seen within 2 minutes
      const lastSeen = new Date(deviceData.lastSeen);
      const minutesSinceLastSeen = (now - lastSeen) / 1000 / 60;
      deviceData.isOnline = minutesSinceLastSeen < 2;
      deviceData.minutesSinceLastSeen = Math.round(minutesSinceLastSeen);
      
      return deviceData;
    });

    res.render('admin/devices', {
      user,
      session: req.session,
      company,
      userCompany,
      devices: devicesWithStatus,
      companies,
      isSuperAdmin: user.isSuperAdmin && !req.session.impersonating,
      title: 'Device Management',
    });
  } catch (error) {
    console.error('❌ Error fetching devices:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'An error occurred while fetching devices.',
    });
  }
});

/**
 * DELETE /admin/devices/:uid
 * Delete a device
 * Access: Super Admin (any device), Owner/Admin/Manager (company devices only)
 */
router.delete('/devices/:uid', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { User } = require('../models');
    const user = await User.findByPk(req.session.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { uid } = req.params;

    // Find the device
    const device = await Device.findOne({
      where: { uid },
      include: [
        {
          model: DevicePlaylist,
          as: 'devicePlaylists',
          include: [
            {
              model: Playlist,
              as: 'playlist',
              include: [
                {
                  model: Company,
                  as: 'company',
                },
              ],
            },
          ],
        },
      ],
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    // Authorization check
    const isSuperAdmin = user.isSuperAdmin && !req.session.impersonating;

    if (!isSuperAdmin) {
      // Check if user is owner/admin/manager of the device's company
      const deviceCompanyIds = device.devicePlaylists.map(
        (dp) => dp.playlist.companyId
      );

      let hasPermission = false;

      // If super admin is impersonating, check if device belongs to impersonated company
      if (req.session.impersonating && req.session.originalSuperAdminId && req.session.companyId) {
        hasPermission = deviceCompanyIds.includes(req.session.companyId);
      } else {
        // For regular company users, check UserCompany records
        const userCompanies = await UserCompany.findAll({
          where: {
            userId: user.id,
            companyId: {
              [Op.in]: deviceCompanyIds,
            },
            role: {
              [Op.in]: ['owner', 'admin', 'manager'],
            },
            isActive: true,
          },
        });

        hasPermission = userCompanies.length > 0;
      }

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this device',
        });
      }
    }

    // Delete device playlists
    const deletedAssociations = await DevicePlaylist.destroy({
      where: {
        deviceId: device.id,
      },
    });

    // Delete device
    await device.destroy();

    console.log(`✅ Device ${uid} deleted by ${user.email}`);

    // Emit socket event to force-deregister if device is online
    const io = req.app.get('io');
    if (io) {
      io.to(`player:${uid}`).emit('device:force-deregister', {
        reason: 'Device deleted by administrator',
        timestamp: new Date(),
      });
      console.log(`📢 Sent force-deregister to device: ${uid}`);
    }

    res.json({
      success: true,
      message: 'Device deleted successfully',
      data: {
        deviceId: device.id,
        uid: device.uid,
        deletedAssociations,
      },
    });
  } catch (error) {
    console.error('❌ Error deleting device:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting device',
      error: error.message,
    });
  }
});

module.exports = router;

