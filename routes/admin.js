/**
 * Super Admin Routes
 * System-wide management for companies, users, videos, and playlists
 */

const express = require('express');
const router = express.Router();
const { User, Company, UserCompany, Video, Playlist, PlaylistItem, Device } = require('../models');
const { webRequireAuth } = require('../middleware/sessionAuth');
const { webRequireSuperAdmin } = require('../middleware/superAdminAuth');

// Apply authentication middleware to all admin routes (auth only, not super admin check yet)
router.use(webRequireAuth);

/**
 * POST /admin/exit-impersonation
 * Return to super admin session
 * NOTE: This route must come BEFORE the webRequireSuperAdmin middleware
 * because impersonating users need access to exit impersonation
 */
router.post('/exit-impersonation', async (req, res) => {
  try {
    if (!req.session.impersonating || !req.session.originalSuperAdminId) {
      return res.status(400).json({
        success: false,
        message: 'Not currently impersonating'
      });
    }

    const originalUserId = req.session.originalSuperAdminId;

    // Restore super admin session
    req.session.userId = originalUserId;
    req.session.isSuperAdmin = true;
    delete req.session.companyId;
    delete req.session.role;
    delete req.session.companies;
    delete req.session.originalSuperAdminId;
    delete req.session.impersonating;

    console.log(`✅ Exited impersonation, returned to super admin: ${originalUserId}`);

    res.json({
      success: true,
      message: 'Returned to admin panel'
    });
  } catch (error) {
    console.error('Exit impersonation error:', error);
    res.status(500).json({ success: false, message: 'Error exiting impersonation' });
  }
});

// Apply super admin middleware to all routes below this point
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
      session: req.session,
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
 * GET /admin/companies/list
 * Get companies list for dropdowns (JSON)
 */
router.get('/companies/list', async (req, res) => {
  try {
    const companies = await Company.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'slug'],
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      companies: companies.map(c => c.toJSON())
    });
  } catch (error) {
    console.error('Get companies list error:', error);
    res.status(500).json({ success: false, message: 'Error loading companies' });
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
      session: req.session,
      companies: companiesData,
    });
  } catch (error) {
    console.error('Admin companies error:', error);
    res.status(500).send('Error loading companies');
  }
});

/**
 * POST /admin/companies/create
 * Create a new company
 */
router.post('/companies/create', async (req, res) => {
  try {
    const { name, description, email, phoneNumber, website, address, isActive } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    // Auto-generate slug from company name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Ensure slug is unique by appending numbers if needed
    let slug = baseSlug;
    let counter = 1;
    while (await Company.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create company
    const company = await Company.create({
      name: name.trim(),
      slug: slug,
      description: description || null,
      email: email || null,
      phoneNumber: phoneNumber || null,
      website: website || null,
      address: address || null,
      isActive: isActive !== false
    });

    console.log(`✅ Company created: ${company.name} (${company.slug})`);

    res.json({
      success: true,
      message: `Company "${company.name}" created successfully`,
      company: { id: company.id, name: company.name, slug: company.slug }
    });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating company: ' + error.message 
    });
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
      session: req.session,
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
      session: req.session,
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
      session: req.session,
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
      session: req.session,
      playlists: playlistsData,
    });
  } catch (error) {
    console.error('Admin playlists error:', error);
    res.status(500).send('Error loading playlists');
  }
});

/**
 * GET /admin/users/:userId
 * Get user details for editing
 */
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get user's companies
    const userCompanies = await UserCompany.findAll({
      where: { userId: userId, isActive: true },
      include: [{
        model: Company,
        as: 'company',
        attributes: ['id', 'name', 'slug']
      }]
    });

    const companies = userCompanies.map(uc => ({
      companyId: uc.companyId,
      companyName: uc.company.name,
      role: uc.role
    }));

    res.json({
      success: true,
      user: user.toJSON(),
      companies: companies
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Error loading user' });
  }
});

/**
 * POST /admin/users/create
 * Create a new user with multiple company and role assignments
 */
router.post('/users/create', async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      phoneNumber, 
      password, 
      isActive, 
      isSuperAdmin,
      companies
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Validate: Non-super admins must have at least one company
    if (!isSuperAdmin && (!companies || companies.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'At least one company assignment is required for non-super admin users'
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phoneNumber: phoneNumber || null,
      password,
      isActive: isActive !== false,
      isSuperAdmin: isSuperAdmin || false
    });

    const assignedCompanies = [];

    // Handle company assignments for non-super admins
    if (!isSuperAdmin && companies && companies.length > 0) {
      for (const companyData of companies) {
        let targetCompanyId = null;

        // Create new company if needed
        if (companyData.isNew && companyData.name) {
          const slug = companyData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          let uniqueSlug = slug;
          let counter = 1;
          while (await Company.findOne({ where: { slug: uniqueSlug } })) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
          }

          const company = await Company.create({
            name: companyData.name,
            slug: uniqueSlug,
            description: companyData.description || null,
            isActive: true
          });

          targetCompanyId = company.id;
          assignedCompanies.push(`${company.name} (${companyData.role})`);
          console.log(`✅ New company created: ${company.name}`);
        } else if (companyData.companyId) {
          // Use existing company
          const company = await Company.findByPk(companyData.companyId);
          if (company) {
            targetCompanyId = companyData.companyId;
            assignedCompanies.push(`${company.name} (${companyData.role})`);
          }
        }

        // Create UserCompany association
        if (targetCompanyId) {
          await UserCompany.create({
            userId: user.id,
            companyId: targetCompanyId,
            role: companyData.role,
            isActive: true
          });

          console.log(`✅ User assigned to company with role: ${companyData.role}`);
        }
      }
    }

    console.log(`✅ User created: ${user.email}${isSuperAdmin ? ' (Super Admin)' : ''}`);

    res.json({
      success: true,
      message: `User ${user.email} created successfully${assignedCompanies.length > 0 ? ` and assigned to: ${assignedCompanies.join(', ')}` : ''}`,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Error creating user: ' + error.message });
  }
});

/**
 * POST /admin/users/:userId/update
 * Update user details and company assignments
 */
router.post('/users/:userId/update', async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, phoneNumber, password, companies } = req.body;

    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if email is being changed to an existing email
    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await User.findOne({
        where: { email: email.toLowerCase() }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another user'
        });
      }
    }

    // Update user
    const updateData = {
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      email: email ? email.toLowerCase() : user.email,
      phoneNumber: phoneNumber !== undefined ? phoneNumber : user.phoneNumber
    };

    // Only update password if provided
    if (password && password.trim().length > 0) {
      updateData.password = password;
    }

    await user.update(updateData);

    // Update company assignments if provided
    if (companies && Array.isArray(companies)) {
      // Deactivate all current company assignments
      await UserCompany.update(
        { isActive: false },
        { where: { userId: userId } }
      );

      // Create new company assignments
      for (const companyData of companies) {
        if (companyData.companyId && companyData.role) {
          // Check if association already exists
          const existing = await UserCompany.findOne({
            where: {
              userId: userId,
              companyId: companyData.companyId
            }
          });

          if (existing) {
            // Reactivate and update role
            await existing.update({
              role: companyData.role,
              isActive: true
            });
          } else {
            // Create new association
            await UserCompany.create({
              userId: userId,
              companyId: companyData.companyId,
              role: companyData.role,
              isActive: true
            });
          }
        }
      }

      console.log(`✅ Updated company assignments for user: ${user.email}`);
    }

    console.log(`✅ User updated: ${user.email}`);

    res.json({
      success: true,
      message: `User ${user.email} updated successfully`
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
});

/**
 * POST /admin/users/:userId/toggle-active
 * Toggle user active status
 */
router.post('/users/:userId/toggle-active', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent deactivating self
    const currentUserId = req.user?.id || req.session?.userId;
    if (userId === currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    await user.update({
      isActive: !user.isActive
    });

    console.log(`✅ User ${user.isActive ? 'activated' : 'deactivated'}: ${user.email}`);

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Toggle user active error:', error);
    res.status(500).json({ success: false, message: 'Error updating user' });
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
 * POST /admin/companies/:companyId/login-as
 * Login as a company (impersonate owner)
 */
router.post('/companies/:companyId/login-as', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Verify company exists
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Find an owner or admin of this company
    const userCompany = await UserCompany.findOne({
      where: {
        companyId: companyId,
        role: 'owner',
        isActive: true
      },
      include: [{
        model: User,
        as: 'user',
        where: { isActive: true }
      }]
    });

    if (!userCompany) {
      return res.status(404).json({
        success: false,
        message: 'No active owner found for this company'
      });
    }

    // Store original super admin session
    req.session.originalSuperAdminId = req.session.userId;
    req.session.impersonating = true;

    // Set session to company owner
    req.session.userId = userCompany.user.id;
    req.session.companyId = companyId;
    req.session.role = 'owner';
    req.session.companies = [{
      id: company.id,
      name: company.name,
      slug: company.slug,
      role: 'owner'
    }];

    console.log(`✅ Super admin (${req.session.originalSuperAdminId}) logged in as company: ${company.name}`);

    res.json({
      success: true,
      message: `Logged in as ${company.name}`
    });
  } catch (error) {
    console.error('Login as company error:', error);
    res.status(500).json({ success: false, message: 'Error logging in as company' });
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


