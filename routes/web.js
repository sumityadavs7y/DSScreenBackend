/**
 * Web Routes for Server-Rendered Pages
 * Handles traditional form submissions and server-side redirects
 */

const express = require('express');
const router = express.Router();
const { User, Company, UserCompany } = require('../models');
const { body, validationResult } = require('express-validator');

/**
 * GET /login
 * Show login page
 */
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
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
 * Show registration page
 */
router.get('/register', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('register', {
    error: req.query.error,
  });
});

/**
 * POST /register
 * Process registration form
 */
router.post('/register',
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
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.redirect(`/register?error=${encodeURIComponent(errors.array()[0].msg)}`);
      }

      const { firstName, lastName, email, phoneNumber, password, companyName, companyDescription } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        return res.redirect(`/register?error=${encodeURIComponent('User with this email already exists')}`);
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

      // Set session
      req.session.userId = user.id;
      req.session.companyId = company.id;
      req.session.role = 'owner';

      res.redirect('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      res.redirect(`/register?error=${encodeURIComponent('An error occurred during registration')}`);
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

