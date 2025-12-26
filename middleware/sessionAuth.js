const { User, Company, UserCompany } = require('../models');

/**
 * Middleware to check if user is authenticated via session
 */
const isAuthenticated = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please login.',
    });
  }
  next();
};

/**
 * Middleware to check if user has selected a company
 */
const hasCompanyContext = (req, res, next) => {
  if (!req.session || !req.session.userId || !req.session.companyId) {
    return res.status(401).json({
      success: false,
      message: 'Company context required. Please select a company.',
    });
  }
  next();
};

/**
 * Middleware to load user and company context from session
 */
const loadUserContext = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Load user
    const user = await User.findByPk(req.session.userId);
    if (!user || !user.isActive) {
      req.session.destroy();
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    req.user = user;

    // Load company context if present
    if (req.session.companyId) {
      const company = await Company.findByPk(req.session.companyId);
      if (!company || !company.isActive) {
        delete req.session.companyId;
        delete req.session.role;
        return res.status(401).json({
          success: false,
          message: 'Company not found or inactive',
        });
      }

      req.company = company;

      // If super admin is impersonating/accessing company, skip UserCompany check
      if (req.session.impersonating && req.session.originalSuperAdminId) {
        // Create a virtual userCompany for super admin with owner role
        req.userCompany = {
          userId: req.session.userId,
          companyId: req.session.companyId,
          role: req.session.role || 'owner',
          isActive: true,
          isSuperAdminAccess: true
        };
      } else {
        // Regular user - check UserCompany
        const userCompany = await UserCompany.findOne({
          where: {
            userId: req.session.userId,
            companyId: req.session.companyId,
            isActive: true,
          },
        });

        if (!userCompany) {
          delete req.session.companyId;
          delete req.session.role;
          return res.status(403).json({
            success: false,
            message: 'Access to this company has been revoked',
          });
        }

        req.userCompany = userCompany;
      }
    }

    next();
  } catch (error) {
    console.error('Session auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

/**
 * Middleware to check if user has specific role in the company
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.session.role) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. No role assigned.',
      });
    }

    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Combined middleware for protected routes with company context
 */
const protect = [loadUserContext, hasCompanyContext];

/**
 * Middleware for routes that need authentication but not company context
 */
const authenticate = [loadUserContext];

/**
 * Alias for loadUserContext (for compatibility)
 */
const requireAuth = loadUserContext;

/**
 * Alias for hasCompanyContext (for compatibility)
 */
const requireCompany = hasCompanyContext;

/**
 * Web middleware - redirects instead of JSON responses
 */
const webRequireAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }

    const user = await User.findByPk(req.session.userId);
    if (!user || !user.isActive) {
      req.session.destroy();
      return res.redirect('/login');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Session authentication error:', error);
    res.redirect('/login');
  }
};

const webRequireCompany = async (req, res, next) => {
  if (!req.session || !req.session.companyId) {
    // Check if super admin trying to access without a company
    if (req.user && req.user.isSuperAdmin && !req.session.impersonating) {
      return res.redirect('/admin');
    }
    return res.redirect('/company-selection');
  }

  try {
    const company = await Company.findByPk(req.session.companyId);
    if (!company || !company.isActive) {
      delete req.session.companyId;
      delete req.session.role;
      return res.redirect('/company-selection');
    }

    req.company = company;

    // If super admin is impersonating/accessing company, skip UserCompany check
    if (req.session.impersonating && req.session.originalSuperAdminId) {
      // Create a virtual userCompany for super admin with owner role
      req.userCompany = {
        userId: req.session.userId,
        companyId: req.session.companyId,
        role: req.session.role || 'owner',
        isActive: true,
        isSuperAdminAccess: true
      };
      return next();
    }

    // Regular user - check UserCompany
    const userCompany = await UserCompany.findOne({
      where: {
        userId: req.session.userId,
        companyId: req.session.companyId,
        isActive: true,
      },
    });

    if (!userCompany) {
      delete req.session.companyId;
      delete req.session.role;
      return res.redirect('/company-selection');
    }

    req.userCompany = userCompany;
    next();
  } catch (error) {
    console.error('Company context error:', error);
    res.redirect('/dashboard');
  }
};

module.exports = {
  isAuthenticated,
  hasCompanyContext,
  loadUserContext,
  requireRole,
  protect,
  authenticate,
  requireAuth,
  requireCompany,
  webRequireAuth,
  webRequireCompany,
};

