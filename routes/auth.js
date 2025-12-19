const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User, Company, UserCompany } = require('../models');
const { jwtConfig } = require('../config');
const { verifyTempToken, verifyToken } = require('../middleware/jwtAuth');

/**
 * Helper function to validate UUID format
 */
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/**
 * Helper function to generate JWT tokens
 */
const generateToken = (payload, expiresIn) => {
  return jwt.sign(payload, jwtConfig.secret, { expiresIn });
};

/**
 * Helper function to generate company slug from name
 */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

/**
 * POST /api/auth/register
 * Register a new user and optionally create a company
 * 
 * Body:
 * - email: string (required)
 * - password: string (required, min 8 characters)
 * - firstName: string (required)
 * - lastName: string (required)
 * - phoneNumber: string (optional)
 * - companyName: string (optional) - if provided, creates a new company
 * - companyDescription: string (optional)
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('phoneNumber').optional().trim(),
  body('companyName').trim().notEmpty().withMessage('Company name is required'),
  body('companyDescription').optional().trim(),
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const {
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      companyName,
      companyDescription,
    } = req.body;

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

    // Create company (required)
    const slug = generateSlug(companyName);
    
    // Check if slug already exists
    let uniqueSlug = slug;
    let counter = 1;
    while (await Company.findOne({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    const company = await Company.create({
      name: companyName,
      slug: uniqueSlug,
      description: companyDescription || null,
    });

    // Link user to company as owner
    const userCompany = await UserCompany.create({
      userId: user.id,
      companyId: company.id,
      role: 'owner',
    });

    // Generate temporary token for company selection
    const tempToken = generateToken(
      {
        userId: user.id,
        type: 'temp',
      },
      jwtConfig.tempTokenExpiry
    );

    res.status(201).json({
      success: true,
      message: 'User and company registered successfully',
      data: {
        user: user.toSafeObject(),
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
        },
        tempToken,
        nextStep: 'Use tempToken to call /api/auth/select-company with the company ID',
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 * Returns a temporary token and list of companies the user has access to
 * 
 * Body:
 * - email: string (required)
 * - password: string (required)
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Get all companies user has access to
    const userCompanies = await UserCompany.findAll({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: [{
        model: Company,
        as: 'company',
        where: { isActive: true },
        attributes: ['id', 'name', 'slug', 'logo'],
      }],
    });

    if (userCompanies.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to any company. Please contact your administrator.',
      });
    }

    // Update last login
    await user.update({ lastLoginAt: new Date() });

    // Generate temporary token
    const tempToken = generateToken(
      {
        userId: user.id,
        type: 'temp',
      },
      jwtConfig.tempTokenExpiry
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toSafeObject(),
        companies: userCompanies.map(uc => ({
          id: uc.company.id,
          name: uc.company.name,
          slug: uc.company.slug,
          logo: uc.company.logo,
          role: uc.role,
        })),
        tempToken,
        nextStep: 'Select a company by calling /api/auth/select-company with tempToken',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/auth/select-company
 * Select a company and get full access token with company context
 * Requires tempToken from login/register
 * 
 * Headers:
 * - Authorization: Bearer <tempToken>
 * 
 * Body:
 * - companyId: string (required)
 */
router.post('/select-company', verifyTempToken, [
  body('companyId').notEmpty().withMessage('Company ID is required'),
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { companyId } = req.body;
    const userId = req.user.id;

    // Validate UUID format
    if (!isValidUUID(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Expected a valid UUID.',
      });
    }

    // Verify user has access to this company
    const userCompany = await UserCompany.findOne({
      where: {
        userId,
        companyId,
        isActive: true,
      },
      include: [{
        model: Company,
        as: 'company',
        where: { isActive: true },
      }],
    });

    if (!userCompany) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this company',
      });
    }

    // Generate access token with company context
    const accessToken = generateToken(
      {
        userId,
        companyId,
        role: userCompany.role,
        type: 'access',
      },
      jwtConfig.accessTokenExpiry
    );

    // Generate refresh token
    const refreshToken = generateToken(
      {
        userId,
        companyId,
        type: 'refresh',
      },
      jwtConfig.refreshTokenExpiry
    );

    res.json({
      success: true,
      message: 'Company selected successfully',
      data: {
        user: req.user.toSafeObject(),
        company: {
          id: userCompany.company.id,
          name: userCompany.company.name,
          slug: userCompany.company.slug,
          logo: userCompany.company.logo,
          settings: userCompany.company.settings,
        },
        role: userCompany.role,
        permissions: userCompany.permissions,
        accessToken,
        refreshToken,
        expiresIn: jwtConfig.accessTokenExpiry,
      },
    });
  } catch (error) {
    console.error('Company selection error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while selecting company',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * 
 * Body:
 * - refreshToken: string (required)
 */
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, jwtConfig.secret);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    // Verify user and company still exist and are active
    const user = await User.findByPk(decoded.userId);
    const company = await Company.findByPk(decoded.companyId);
    const userCompany = await UserCompany.findOne({
      where: {
        userId: decoded.userId,
        companyId: decoded.companyId,
        isActive: true,
      },
    });

    if (!user || !user.isActive || !company || !company.isActive || !userCompany) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Generate new access token
    const accessToken = generateToken(
      {
        userId: decoded.userId,
        companyId: decoded.companyId,
        role: userCompany.role,
        type: 'access',
      },
      jwtConfig.accessTokenExpiry
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        expiresIn: jwtConfig.accessTokenExpiry,
      },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has expired. Please login again.',
      });
    }

    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while refreshing token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client should discard tokens)
 * Requires accessToken
 * 
 * Headers:
 * - Authorization: Bearer <accessToken>
 */
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // In a JWT-based system, logout is primarily client-side
    // Here you could add logic to blacklist the token if needed
    // For now, we'll just acknowledge the logout
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during logout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info with company context
 * Requires accessToken
 * 
 * Headers:
 * - Authorization: Bearer <accessToken>
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user.toSafeObject(),
        company: {
          id: req.company.id,
          name: req.company.name,
          slug: req.company.slug,
          logo: req.company.logo,
          website: req.company.website,
          settings: req.company.settings,
        },
        role: req.userCompany.role,
        permissions: req.userCompany.permissions,
      },
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user info',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/auth/companies
 * Get all companies the user has access to
 * Requires accessToken
 * 
 * Headers:
 * - Authorization: Bearer <accessToken>
 */
router.get('/companies', verifyToken, async (req, res) => {
  try {
    const userCompanies = await UserCompany.findAll({
      where: {
        userId: req.user.id,
        isActive: true,
      },
      include: [{
        model: Company,
        as: 'company',
        where: { isActive: true },
        attributes: ['id', 'name', 'slug', 'logo', 'description'],
      }],
    });

    res.json({
      success: true,
      data: {
        companies: userCompanies.map(uc => ({
          id: uc.company.id,
          name: uc.company.name,
          slug: uc.company.slug,
          logo: uc.company.logo,
          description: uc.company.description,
          role: uc.role,
          joinedAt: uc.joinedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching companies',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/auth/switch-company
 * Switch to a different company
 * Requires accessToken
 * 
 * Headers:
 * - Authorization: Bearer <accessToken>
 * 
 * Body:
 * - companyId: string (required)
 */
router.post('/switch-company', verifyToken, [
  body('companyId').notEmpty().withMessage('Company ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { companyId } = req.body;
    const userId = req.user.id;

    // Validate UUID format
    if (!isValidUUID(companyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid company ID format. Expected a valid UUID.',
      });
    }

    // Verify user has access to this company
    const userCompany = await UserCompany.findOne({
      where: {
        userId,
        companyId,
        isActive: true,
      },
      include: [{
        model: Company,
        as: 'company',
        where: { isActive: true },
      }],
    });

    if (!userCompany) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this company',
      });
    }

    // Generate new access token with new company context
    const accessToken = generateToken(
      {
        userId,
        companyId,
        role: userCompany.role,
        type: 'access',
      },
      jwtConfig.accessTokenExpiry
    );

    // Generate new refresh token
    const refreshToken = generateToken(
      {
        userId,
        companyId,
        type: 'refresh',
      },
      jwtConfig.refreshTokenExpiry
    );

    res.json({
      success: true,
      message: 'Company switched successfully',
      data: {
        company: {
          id: userCompany.company.id,
          name: userCompany.company.name,
          slug: userCompany.company.slug,
          logo: userCompany.company.logo,
          settings: userCompany.company.settings,
        },
        role: userCompany.role,
        permissions: userCompany.permissions,
        accessToken,
        refreshToken,
        expiresIn: jwtConfig.accessTokenExpiry,
      },
    });
  } catch (error) {
    console.error('Company switch error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while switching company',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;

