/**
 * Company Management Routes
 * 
 * Endpoints for managing company members, roles, and invitations
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { User, Company, UserCompany } = require('../models');
const { protect, requireRole } = require('../middleware/sessionAuth');
const verifyToken = protect; // Alias for compatibility

/**
 * Helper function to validate UUID format
 */
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * GET /api/company/members
 * Get all members of the current company
 * Requires: accessToken
 * Allowed roles: All authenticated users
 */
router.get('/members', verifyToken, async (req, res) => {
  try {
    const members = await UserCompany.findAll({
      where: {
        companyId: req.company.id,
        isActive: true,
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'firstName', 'lastName', 'phoneNumber', 'isActive', 'lastLoginAt'],
      }],
      order: [['joinedAt', 'DESC']],
    });

    const formattedMembers = members.map(member => ({
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      phoneNumber: member.user.phoneNumber,
      role: member.role,
      permissions: member.permissions,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
      lastLoginAt: member.user.lastLoginAt,
    }));

    res.json({
      success: true,
      data: {
        company: {
          id: req.company.id,
          name: req.company.name,
        },
        members: formattedMembers,
        count: formattedMembers.length,
      },
    });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching members',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/company/members/add
 * Add an existing user to the company
 * Requires: accessToken
 * Allowed roles: owner, admin
 */
router.post('/members/add', 
  verifyToken, 
  requireRole('owner', 'admin'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('role').isIn(['admin', 'manager', 'member', 'viewer']).withMessage('Invalid role. Allowed: admin, manager, member, viewer'),
    body('permissions').optional().isObject().withMessage('Permissions must be an object'),
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

      const { email, role, permissions } = req.body;

      // Find the user by email
      const user = await User.findOne({ where: { email } });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User with this email does not exist. They need to register first.',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'This user account is inactive.',
        });
      }

      // Check if user is already a member of this company
      const existingMembership = await UserCompany.findOne({
        where: {
          userId: user.id,
          companyId: req.company.id,
        },
      });

      if (existingMembership) {
        if (existingMembership.isActive) {
          return res.status(409).json({
            success: false,
            message: 'User is already a member of this company',
          });
        } else {
          // Reactivate membership
          await existingMembership.update({
            isActive: true,
            role: role || existingMembership.role,
            permissions: permissions || existingMembership.permissions,
            joinedAt: new Date(),
          });

          return res.json({
            success: true,
            message: 'User membership reactivated',
            data: {
              userId: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: existingMembership.role,
              permissions: existingMembership.permissions,
            },
          });
        }
      }

      // Add user to company
      const userCompany = await UserCompany.create({
        userId: user.id,
        companyId: req.company.id,
        role: role || 'member',
        permissions: permissions || {},
        isActive: true,
        joinedAt: new Date(),
      });

      res.status(201).json({
        success: true,
        message: 'User added to company successfully',
        data: {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: userCompany.role,
          permissions: userCompany.permissions,
          joinedAt: userCompany.joinedAt,
        },
      });
    } catch (error) {
      console.error('Add member error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while adding member',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/company/members/add-by-id
 * Add an existing user to the company by user ID
 * Requires: accessToken
 * Allowed roles: owner, admin
 */
router.post('/members/add-by-id', 
  verifyToken, 
  requireRole('owner', 'admin'),
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('role').isIn(['admin', 'manager', 'member', 'viewer']).withMessage('Invalid role. Allowed: admin, manager, member, viewer'),
    body('permissions').optional().isObject().withMessage('Permissions must be an object'),
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

      const { userId, role, permissions } = req.body;

      // Validate UUID format
      if (!isValidUUID(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format. Expected a valid UUID.',
        });
      }

      // Find the user
      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'This user account is inactive.',
        });
      }

      // Check if user is already a member of this company
      const existingMembership = await UserCompany.findOne({
        where: {
          userId: user.id,
          companyId: req.company.id,
        },
      });

      if (existingMembership) {
        if (existingMembership.isActive) {
          return res.status(409).json({
            success: false,
            message: 'User is already a member of this company',
          });
        } else {
          // Reactivate membership
          await existingMembership.update({
            isActive: true,
            role: role || existingMembership.role,
            permissions: permissions || existingMembership.permissions,
            joinedAt: new Date(),
          });

          return res.json({
            success: true,
            message: 'User membership reactivated',
            data: {
              userId: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: existingMembership.role,
              permissions: existingMembership.permissions,
            },
          });
        }
      }

      // Add user to company
      const userCompany = await UserCompany.create({
        userId: user.id,
        companyId: req.company.id,
        role: role || 'member',
        permissions: permissions || {},
        isActive: true,
        joinedAt: new Date(),
      });

      res.status(201).json({
        success: true,
        message: 'User added to company successfully',
        data: {
          userId: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: userCompany.role,
          permissions: userCompany.permissions,
          joinedAt: userCompany.joinedAt,
        },
      });
    } catch (error) {
      console.error('Add member error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while adding member',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * PUT /api/company/members/:userId/role
 * Update a user's role in the company
 * Requires: accessToken
 * Allowed roles: owner, admin
 */
router.put('/members/:userId/role', 
  verifyToken, 
  requireRole('owner', 'admin'),
  [
    body('role').isIn(['owner', 'admin', 'manager', 'member', 'viewer']).withMessage('Invalid role'),
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

      const { userId } = req.params;
      const { role } = req.body;

      // Validate UUID format
      if (!isValidUUID(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format. Expected a valid UUID.',
        });
      }

      // Prevent users from changing their own role
      if (userId === req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You cannot change your own role',
        });
      }

      // Find the membership
      const membership = await UserCompany.findOne({
        where: {
          userId,
          companyId: req.company.id,
          isActive: true,
        },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        }],
      });

      if (!membership) {
        return res.status(404).json({
          success: false,
          message: 'User is not a member of this company',
        });
      }

      // Only owners can promote to owner, and there should be a warning mechanism
      if (role === 'owner' && req.userCompany.role !== 'owner') {
        return res.status(403).json({
          success: false,
          message: 'Only company owners can assign owner role',
        });
      }

      // Update role
      await membership.update({ role });

      res.json({
        success: true,
        message: 'User role updated successfully',
        data: {
          userId: membership.userId,
          email: membership.user.email,
          firstName: membership.user.firstName,
          lastName: membership.user.lastName,
          role: membership.role,
          previousRole: membership._previousDataValues.role,
        },
      });
    } catch (error) {
      console.error('Update role error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while updating role',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * PUT /api/company/members/:userId/permissions
 * Update a user's permissions in the company
 * Requires: accessToken
 * Allowed roles: owner, admin
 */
router.put('/members/:userId/permissions', 
  verifyToken, 
  requireRole('owner', 'admin'),
  [
    body('permissions').isObject().withMessage('Permissions must be an object'),
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

      const { userId } = req.params;
      const { permissions } = req.body;

      // Validate UUID format
      if (!isValidUUID(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format. Expected a valid UUID.',
        });
      }

      // Find the membership
      const membership = await UserCompany.findOne({
        where: {
          userId,
          companyId: req.company.id,
          isActive: true,
        },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        }],
      });

      if (!membership) {
        return res.status(404).json({
          success: false,
          message: 'User is not a member of this company',
        });
      }

      // Update permissions
      await membership.update({ permissions });

      res.json({
        success: true,
        message: 'User permissions updated successfully',
        data: {
          userId: membership.userId,
          email: membership.user.email,
          permissions: membership.permissions,
        },
      });
    } catch (error) {
      console.error('Update permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while updating permissions',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * DELETE /api/company/members/:userId
 * Remove a user from the company (soft delete)
 * Requires: accessToken
 * Allowed roles: owner, admin
 */
router.delete('/members/:userId', 
  verifyToken, 
  requireRole('owner', 'admin'),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Validate UUID format
      if (!isValidUUID(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format. Expected a valid UUID.',
        });
      }

      // Prevent users from removing themselves
      if (userId === req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You cannot remove yourself from the company. Use a different account or transfer ownership first.',
        });
      }

      // Find the membership
      const membership = await UserCompany.findOne({
        where: {
          userId,
          companyId: req.company.id,
          isActive: true,
        },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'firstName', 'lastName'],
        }],
      });

      if (!membership) {
        return res.status(404).json({
          success: false,
          message: 'User is not a member of this company',
        });
      }

      // Prevent removing the last owner
      if (membership.role === 'owner') {
        const ownerCount = await UserCompany.count({
          where: {
            companyId: req.company.id,
            role: 'owner',
            isActive: true,
          },
        });

        if (ownerCount <= 1) {
          return res.status(403).json({
            success: false,
            message: 'Cannot remove the last owner. Promote another user to owner first.',
          });
        }
      }

      // Soft delete (deactivate)
      await membership.update({ isActive: false });

      res.json({
        success: true,
        message: 'User removed from company successfully',
        data: {
          userId: membership.userId,
          email: membership.user.email,
          removedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while removing member',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/company/info
 * Get current company information
 * Requires: accessToken
 * Allowed roles: All authenticated users
 */
router.get('/info', verifyToken, async (req, res) => {
  try {
    const memberCount = await UserCompany.count({
      where: {
        companyId: req.company.id,
        isActive: true,
      },
    });

    res.json({
      success: true,
      data: {
        company: {
          id: req.company.id,
          name: req.company.name,
          slug: req.company.slug,
          description: req.company.description,
          logo: req.company.logo,
          website: req.company.website,
          email: req.company.email,
          phoneNumber: req.company.phoneNumber,
          address: req.company.address,
          settings: req.company.settings,
          createdAt: req.company.createdAt,
        },
        memberCount,
        yourRole: req.userCompany.role,
        yourPermissions: req.userCompany.permissions,
      },
    });
  } catch (error) {
    console.error('Get company info error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching company info',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * PUT /api/company/info
 * Update company information
 * Requires: accessToken
 * Allowed roles: owner, admin
 */
router.put('/info', 
  verifyToken, 
  requireRole('owner', 'admin'),
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('description').optional().trim(),
    body('website').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phoneNumber').optional().trim(),
    body('address').optional().trim(),
    body('logo').optional().trim(),
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

      const { name, description, website, email, phoneNumber, address, logo } = req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (website !== undefined) updateData.website = website;
      if (email !== undefined) updateData.email = email;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (address !== undefined) updateData.address = address;
      if (logo !== undefined) updateData.logo = logo;

      await req.company.update(updateData);

      res.json({
        success: true,
        message: 'Company information updated successfully',
        data: {
          company: {
            id: req.company.id,
            name: req.company.name,
            slug: req.company.slug,
            description: req.company.description,
            logo: req.company.logo,
            website: req.company.website,
            email: req.company.email,
            phoneNumber: req.company.phoneNumber,
            address: req.company.address,
          },
        },
      });
    } catch (error) {
      console.error('Update company info error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while updating company info',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

module.exports = router;

