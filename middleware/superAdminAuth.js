/**
 * Super Admin Authentication Middleware
 * Checks if the authenticated user has super admin privileges
 */

const { User } = require('../models');

/**
 * Middleware to check if user is a super admin
 * Must be used after sessionAuth middleware
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check if user is super admin
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Super admin access required',
      });
    }

    next();
  } catch (error) {
    console.error('Super admin auth error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during authentication',
    });
  }
};

/**
 * Web middleware to check if user is a super admin (redirects to error page)
 */
const webRequireSuperAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      return res.redirect('/login?error=' + encodeURIComponent('Authentication required'));
    }

    // Fetch user to check super admin status
    const user = await User.findByPk(req.session.userId);
    
    if (!user || !user.isSuperAdmin) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'Super admin access required',
        error: {
          status: 403,
          stack: process.env.NODE_ENV === 'development' ? 'Super admin privileges required to access this page' : '',
        },
        user: req.user || null,
      });
    }

    // Attach super admin flag to request
    req.isSuperAdmin = true;
    next();
  } catch (error) {
    console.error('Super admin web auth error:', error);
    res.status(500).send('Authentication error');
  }
};

module.exports = {
  requireSuperAdmin,
  webRequireSuperAdmin,
};


