/**
 * User Management Routes
 * 
 * Endpoints for users without a company to be added by company admins
 * This is an alternative to self-registration
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { User, Company, UserCompany } = require('../models');
const { protect, requireRole } = require('../middleware/sessionAuth');
const verifyToken = protect; // Alias for compatibility

/**
 * POST /api/users/create
 * Create a new user without company (by company admin to later add them)
 * This allows admins to create user accounts that they can then add to their company
 * Requires: accessToken
 * Allowed roles: owner, admin
 */
router.post('/create', 
  verifyToken, 
  requireRole('owner', 'admin'),
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('phoneNumber').optional().trim(),
    body('addToCurrentCompany').optional().isBoolean().withMessage('addToCurrentCompany must be boolean'),
    body('role').optional().isIn(['admin', 'manager', 'member', 'viewer']).withMessage('Invalid role'),
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

      const { email, password, firstName, lastName, phoneNumber, addToCurrentCompany, role } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
      }

      // Create user
      const user = await User.create({
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
      });

      let userCompany = null;

      // Optionally add to current company
      if (addToCurrentCompany === true) {
        userCompany = await UserCompany.create({
          userId: user.id,
          companyId: req.company.id,
          role: role || 'member',
          isActive: true,
          joinedAt: new Date(),
        });
      }

      res.status(201).json({
        success: true,
        message: addToCurrentCompany 
          ? 'User created and added to your company successfully' 
          : 'User created successfully. You can now add them to your company.',
        data: {
          user: user.toSafeObject(),
          addedToCompany: addToCurrentCompany === true,
          company: addToCurrentCompany ? {
            id: req.company.id,
            name: req.company.name,
            role: userCompany.role,
          } : null,
        },
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while creating user',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * GET /api/users/search
 * Search for users by email (to add to company)
 * Requires: accessToken
 * Allowed roles: owner, admin
 */
router.get('/search', 
  verifyToken, 
  requireRole('owner', 'admin'),
  async (req, res) => {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email query parameter is required',
        });
      }

      // Search for users by email (partial match)
      const users = await User.findAll({
        where: {
          email: {
            [require('../models').Sequelize.Op.iLike]: `%${email}%`,
          },
          isActive: true,
        },
        attributes: ['id', 'email', 'firstName', 'lastName', 'phoneNumber'],
        limit: 10,
      });

      // Check if users are already in the company
      const usersWithStatus = await Promise.all(users.map(async (user) => {
        const membership = await UserCompany.findOne({
          where: {
            userId: user.id,
            companyId: req.company.id,
            isActive: true,
          },
        });

        return {
          ...user.toJSON(),
          isInCompany: !!membership,
          role: membership ? membership.role : null,
        };
      }));

      res.json({
        success: true,
        data: {
          users: usersWithStatus,
          count: usersWithStatus.length,
        },
      });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred while searching users',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

module.exports = router;

