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

      req.company = company;
      req.userCompany = userCompany;
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

module.exports = {
  isAuthenticated,
  hasCompanyContext,
  loadUserContext,
  requireRole,
  protect,
  authenticate,
};

