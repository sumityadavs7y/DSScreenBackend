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
    // Check if this is an API call (expects JSON response)
    const isApiCall = req.xhr || req.headers.accept?.includes('application/json') || req.path.includes('/create') || req.path.includes('/update') || req.path.includes('/toggle');

    // Check if user is authenticated
    if (!req.session || !req.session.userId) {
      if (isApiCall) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      return res.redirect('/login?error=' + encodeURIComponent('Authentication required'));
    }

    // Check if user is impersonating - if so, they're not allowed in admin panel
    if (req.session.impersonating) {
      if (isApiCall) {
        return res.status(403).json({ success: false, message: 'Please exit impersonation mode to access admin panel' });
      }
      return res.redirect('/dashboard?error=' + encodeURIComponent('Please exit impersonation mode to access admin panel'));
    }

    // Fetch user to check super admin status
    const user = await User.findByPk(req.session.userId);
    
    if (!user || !user.isSuperAdmin) {
      if (isApiCall) {
        return res.status(403).json({ success: false, message: 'Access Denied: Super admin privileges required' });
      }
      return res.redirect('/dashboard?error=' + encodeURIComponent('Access Denied: Super admin privileges required'));
    }

    // Attach super admin flag to request
    req.isSuperAdmin = true;
    next();
  } catch (error) {
    console.error('Super admin web auth error:', error);
    const isApiCall = req.xhr || req.headers.accept?.includes('application/json') || req.path.includes('/create') || req.path.includes('/update') || req.path.includes('/toggle');
    if (isApiCall) {
      return res.status(500).json({ success: false, message: 'Authentication error' });
    }
    res.status(500).send('Authentication error');
  }
};

module.exports = {
  requireSuperAdmin,
  webRequireSuperAdmin,
};


