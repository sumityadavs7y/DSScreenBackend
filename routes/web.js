/**
 * Web Routes for Server-Rendered Pages
 * Handles traditional form submissions and server-side redirects
 */

const express = require('express');
const router = express.Router();
const { User, Company, UserCompany, License } = require('../models');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');

/**
 * GET /
 * Root route - redirect based on authentication status
 */
router.get('/', async (req, res) => {
  // If not authenticated, show device registration page
  if (!req.session || !req.session.userId) {
    return res.sendFile(require('path').join(__dirname, '../public/index.html'));
  }
  
  // If authenticated, check if super admin
  try {
    const user = await User.findByPk(req.session.userId);
    if (user && user.isSuperAdmin && !req.session.impersonating) {
      return res.redirect('/admin');
    }
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Root route error:', error);
    return res.redirect('/login');
  }
});

/**
 * GET /login
 * Show login page
 */
router.get('/login', async (req, res) => {
  if (req.session && req.session.userId) {
    // Check if user is super admin
    const user = await User.findByPk(req.session.userId);
    if (user && user.isSuperAdmin) {
      return res.redirect('/admin');
    }
    return res.redirect('/dashboard');
  }
  res.render('login', {
    error: req.query.error,
  });
});

/**
 * POST /login
 * Process login form
 */
router.post('/login', 
  [
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.redirect(`/login?error=${encodeURIComponent(errors.array()[0].msg)}`);
      }

      const { email, password } = req.body;

      const user = await User.findOne({
        where: { email: email.toLowerCase() },
      });

      if (!user || !user.isActive) {
        return res.redirect(`/login?error=${encodeURIComponent('Invalid email or password')}`);
      }

      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        return res.redirect(`/login?error=${encodeURIComponent('Invalid email or password')}`);
      }

      // Check if user is super admin
      if (user.isSuperAdmin) {
        // Super admins don't need a company, redirect to admin panel
        req.session.userId = user.id;
        req.session.isSuperAdmin = true;
        return res.redirect('/admin');
      }

      // Get user's companies
      const userCompanies = await UserCompany.findAll({
        where: {
          userId: user.id,
          isActive: true,
        },
        include: [{
          model: Company,
          as: 'company',
          where: { isActive: true },
        }],
      });

      if (userCompanies.length === 0) {
        return res.redirect(`/login?error=${encodeURIComponent('No active company found for this user')}`);
      }

      // Set session
      req.session.userId = user.id;
      req.session.companies = userCompanies.map(uc => ({
        id: uc.company.id,
        name: uc.company.name,
        slug: uc.company.slug,
        role: uc.role,
      }));

      // If only one company, auto-select it
      if (userCompanies.length === 1) {
        req.session.companyId = userCompanies[0].companyId;
        req.session.role = userCompanies[0].role;
        return res.redirect('/dashboard');
      }

      // Multiple companies, redirect to selection page
      res.redirect('/company-selection');
    } catch (error) {
      console.error('Login error:', error);
      res.redirect(`/login?error=${encodeURIComponent('An error occurred during login')}`);
    }
  }
);

/**
 * GET /register
 * PUBLIC REGISTRATION DISABLED - Use license-based registration instead
 */
router.get('/register', (req, res) => {
  res.status(403).render('error', {
    title: 'Registration Closed',
    message: 'Public registration is not available. Please contact your administrator for a registration link.',
  });
});

/**
 * POST /register
 * PUBLIC REGISTRATION DISABLED - Use license-based registration instead
 */
router.post('/register', async (req, res) => {
  res.status(403).json({ 
    success: false, 
    message: 'Public registration is not available. Please contact your administrator for a registration link.' 
  });
});

/**
 * GET /license-signup/:token
 * Show license-based registration page
 */
router.get('/license-signup/:token', async (req, res) => {
  try {
    if (req.session && req.session.userId) {
      return res.redirect('/dashboard');
    }

    const { token } = req.params;

    // Validate license
    const license = await License.findOne({
      where: { token },
    });

    if (!license) {
      return res.status(404).render('error', {
        title: 'Invalid License',
        message: 'The registration link you used is invalid. Please contact your administrator.',
      });
    }

    if (license.isUsed) {
      return res.status(403).render('error', {
        title: 'License Already Used',
        message: 'This registration link has already been used. Please contact your administrator for a new link.',
      });
    }

    if (new Date(license.expiresAt) <= new Date()) {
      return res.status(403).render('error', {
        title: 'License Expired',
        message: 'This registration link has expired. Please contact your administrator for a new link.',
      });
    }

    // Show registration form with license info
    res.render('license-register', {
      error: req.query.error,
      token,
      companyName: license.companyName || '',
      licenseExpiresAt: license.expiresAt,
    });
  } catch (error) {
    console.error('License signup error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'An error occurred. Please try again later.',
    });
  }
});

/**
 * POST /license-signup/:token
 * Process license-based registration
 */
router.post('/license-signup/:token',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
    body('companyName').trim().notEmpty().withMessage('Company name is required'),
  ],
  async (req, res) => {
    try {
      const { token } = req.params;
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.redirect(`/license-signup/${token}?error=${encodeURIComponent(errors.array()[0].msg)}`);
      }

      const { firstName, lastName, email, phoneNumber, password, companyName, companyDescription } = req.body;

      // Validate license again
      const license = await License.findOne({
        where: { token },
      });

      if (!license || license.isUsed || new Date(license.expiresAt) <= new Date()) {
        return res.status(403).render('error', {
          title: 'Invalid License',
          message: 'This registration link is no longer valid.',
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        return res.redirect(`/license-signup/${token}?error=${encodeURIComponent('User with this email already exists')}`);
      }

      // Create user
      const user = await User.create({
        firstName,
        lastName,
        email: email.toLowerCase(),
        phoneNumber: phoneNumber || null,
        password,
        isActive: true,
      });

      // Create company with unique slug
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
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
      await UserCompany.create({
        userId: user.id,
        companyId: company.id,
        role: 'owner',
      });

      // Mark license as used and active for this company
      await license.update({
        isActive: true,
        isUsed: true,
        usedAt: new Date(),
        companyId: company.id,
      });

      console.log(`✅ License ${license.id} used for company ${company.name}`);

      // Set session
      req.session.userId = user.id;
      req.session.companyId = company.id;
      req.session.role = 'owner';

      res.redirect('/dashboard');
    } catch (error) {
      console.error('License registration error:', error);
      res.redirect(`/license-signup/${req.params.token}?error=${encodeURIComponent('An error occurred during registration')}`);
    }
  }
);

/**
 * GET /company-selection
 * Show company selection page
 */
router.get('/company-selection', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }

    const user = await User.findByPk(req.session.userId);
    if (!user) {
      req.session.destroy();
      return res.redirect('/login');
    }

    const companies = req.session.companies || [];
    if (companies.length === 0) {
      return res.redirect(`/login?error=${encodeURIComponent('No companies found')}`);
    }

    res.render('company-selection', {
      user,
      companies,
    });
  } catch (error) {
    console.error('Company selection error:', error);
    res.redirect(`/login?error=${encodeURIComponent('An error occurred')}`);
  }
});

/**
 * POST /company-selection
 * Process company selection
 */
router.post('/company-selection', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }

    const { companyId } = req.body;

    // Verify user has access to this company
    const companies = req.session.companies || [];
    const selectedCompany = companies.find(c => c.id === companyId);

    if (!selectedCompany) {
      return res.redirect(`/company-selection?error=${encodeURIComponent('Invalid company selection')}`);
    }

    req.session.companyId = selectedCompany.id;
    req.session.role = selectedCompany.role;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Company selection error:', error);
    res.redirect(`/company-selection?error=${encodeURIComponent('An error occurred')}`);
  }
});

/**
 * POST /logout
 * Logout user
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;

