const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config');
const { User, Company, UserCompany } = require('../models');

/**
 * Middleware to verify JWT token and extract user & company context
 * This middleware expects the token in the Authorization header as "Bearer <token>"
 */
const verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is missing or invalid format',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, jwtConfig.secret);

    // Check token type - we need a full access token with company context
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type. Please select a company first.',
      });
    }

    // Verify user still exists and is active
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    // Verify company still exists and is active
    const company = await Company.findByPk(decoded.companyId);
    if (!company || !company.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Company not found or inactive',
      });
    }

    // Verify user still has access to this company
    const userCompany = await UserCompany.findOne({
      where: {
        userId: decoded.userId,
        companyId: decoded.companyId,
        isActive: true,
      },
    });

    if (!userCompany) {
      return res.status(403).json({
        success: false,
        message: 'Access to this company has been revoked',
      });
    }

    // Attach user, company, and userCompany info to request
    req.user = user;
    req.company = company;
    req.userCompany = userCompany;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
      });
    }

    console.error('JWT verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

/**
 * Middleware to verify temporary token (used after login, before company selection)
 */
const verifyTempToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token is missing or invalid format',
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtConfig.secret);

    // Check token type - we need a temp token
    if (decoded.type !== 'temp') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    // Verify user still exists and is active
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    req.user = user;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Temporary token has expired. Please login again.',
      });
    }

    console.error('JWT verification error:', error);
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
    if (!req.userCompany) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    if (!allowedRoles.includes(req.userCompany.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if token is missing/invalid
 * but attaches user/company info if valid token is provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtConfig.secret);

    if (decoded.type === 'access') {
      const user = await User.findByPk(decoded.userId);
      const company = await Company.findByPk(decoded.companyId);
      const userCompany = await UserCompany.findOne({
        where: {
          userId: decoded.userId,
          companyId: decoded.companyId,
          isActive: true,
        },
      });

      if (user && company && userCompany) {
        req.user = user;
        req.company = company;
        req.userCompany = userCompany;
        req.tokenPayload = decoded;
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

module.exports = {
  verifyToken,
  verifyTempToken,
  requireRole,
  optionalAuth,
};

