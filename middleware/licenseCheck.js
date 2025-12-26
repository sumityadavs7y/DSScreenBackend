const { Company, License } = require('../models');

/**
 * Middleware to check if company's license is valid (not expired)
 * Prevents expired companies from adding new content
 */
const checkCompanyLicense = async (req, res, next) => {
  try {
    // Skip check for super admins (including when impersonating)
    if (req.user && req.user.isSuperAdmin) {
      return next();
    }
    
    // Also skip if super admin is impersonating
    if (req.session && req.session.impersonating && req.session.originalSuperAdminId) {
      return next();
    }

    // Get company ID from session or request
    const companyId = req.session.companyId || req.body.companyId || req.params.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: 'Company context required',
      });
    }

    // Fetch company
    const company = await Company.findByPk(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found',
      });
    }

    // Find active license for this company
    const activeLicense = await License.findOne({
      where: {
        companyId: companyId,
        isActive: true,
      },
    });

    // Check if company has an active license assigned
    if (!activeLicense) {
      return res.status(403).json({
        success: false,
        message: 'No license assigned to this company. Please contact your administrator to get a license.',
        licenseExpired: false,
        noLicense: true,
      });
    }

    // Check if license is expired
    const now = new Date();
    const expiryDate = new Date(activeLicense.expiresAt);

    if (expiryDate < now) {
      return res.status(403).json({
        success: false,
        message: 'Company license has expired. Please contact your administrator to renew your license.',
        licenseExpired: true,
        expiresAt: activeLicense.expiresAt,
      });
    }

    // Check storage limit (only for upload operations)
    // This is a soft check - we'll do hard check in upload endpoint
    if (req.method === 'POST' && (req.path.includes('/upload') || req.path.includes('/create'))) {
      const storageUsed = company.storageUsedBytes || 0;
      const storageLimit = activeLicense.maxStorageBytes || 10737418240; // 10GB default
      
      if (storageUsed >= storageLimit) {
        return res.status(403).json({
          success: false,
          message: 'Company storage limit reached. Please contact your administrator to upgrade your license or free up space.',
          storageLimitReached: true,
          storageUsed: storageUsed,
          storageLimit: storageLimit,
        });
      }
    }

    // License is valid, proceed
    next();
  } catch (error) {
    console.error('License check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking license status',
    });
  }
};

/**
 * Middleware for web routes (redirects instead of JSON)
 */
const webCheckCompanyLicense = async (req, res, next) => {
  try {
    console.log('🔍 LICENSE CHECK - User:', req.user?.email);
    console.log('🔍 LICENSE CHECK - isSuperAdmin:', req.user?.isSuperAdmin);
    console.log('🔍 LICENSE CHECK - impersonating:', req.session?.impersonating);
    console.log('🔍 LICENSE CHECK - originalSuperAdminId:', req.session?.originalSuperAdminId);
    
    // Skip check for super admins (including when impersonating)
    if (req.user && req.user.isSuperAdmin) {
      console.log('✅ LICENSE CHECK - BYPASSED for super admin');
      return next();
    }
    
    // Also skip if super admin is impersonating
    if (req.session && req.session.impersonating && req.session.originalSuperAdminId) {
      console.log('✅ LICENSE CHECK - BYPASSED for impersonating super admin');
      return next();
    }

    const companyId = req.session.companyId;
    console.log('🔍 LICENSE CHECK - Company ID:', companyId);

    if (!companyId) {
      console.log('❌ LICENSE CHECK - No company ID');
      return res.redirect('/company-selection');
    }

    const company = await Company.findByPk(companyId);

    if (!company) {
      console.log('❌ LICENSE CHECK - Company not found');
      return res.redirect('/company-selection');
    }

    console.log('🔍 LICENSE CHECK - Company:', company.name);

    // Find active license for this company
    const activeLicense = await License.findOne({
      where: {
        companyId: companyId,
        isActive: true,
      },
    });

    console.log('🔍 LICENSE CHECK - Active license found:', !!activeLicense);
    if (activeLicense) {
      console.log('🔍 LICENSE CHECK - License expires at:', activeLicense.expiresAt);
    }

    // Check if company has an active license assigned
    if (!activeLicense) {
      console.log('❌ LICENSE CHECK - BLOCKED: No active license assigned');
      return res.status(403).render('error', {
        title: 'No License',
        message: 'No license has been assigned to your company. Please contact your administrator to get a license.',
      });
    }

    // Check if license is expired
    const now = new Date();
    const expiryDate = new Date(activeLicense.expiresAt);
    console.log('🔍 LICENSE CHECK - Current date:', now);
    console.log('🔍 LICENSE CHECK - Expiry date:', expiryDate);
    console.log('🔍 LICENSE CHECK - Is expired?:', expiryDate < now);

    if (expiryDate < now) {
      console.log('❌ LICENSE CHECK - BLOCKED: License expired');
      return res.status(403).render('error', {
        title: 'License Expired',
        message: `Your company's license expired on ${expiryDate.toLocaleDateString()}. Please contact your administrator to renew your license.`,
      });
    }

    // Check storage limit (only for upload operations)
    if (req.method === 'POST' && (req.path.includes('/upload') || req.path.includes('/create'))) {
      const storageUsed = company.storageUsedBytes || 0;
      const storageLimit = activeLicense.maxStorageBytes || 10737418240; // 10GB default
      
      console.log('🔍 LICENSE CHECK - Storage used:', storageUsed);
      console.log('🔍 LICENSE CHECK - Storage limit:', storageLimit);
      
      if (storageUsed >= storageLimit) {
        console.log('❌ LICENSE CHECK - BLOCKED: Storage limit reached');
        const usedMB = (storageUsed / (1024 * 1024)).toFixed(2);
        const limitMB = (storageLimit / (1024 * 1024)).toFixed(2);
        return res.redirect(`/dashboard/videos?error=${encodeURIComponent(`Storage limit reached (${usedMB}MB / ${limitMB}MB). Please contact your administrator to upgrade your license or free up space.`)}`);
      }
    }

    // License is valid, proceed
    console.log('✅ LICENSE CHECK - PASSED: License is valid');
    next();
  } catch (error) {
    console.error('License check error:', error);
    res.status(500).send('Error checking license status');
  }
};

module.exports = {
  checkCompanyLicense,
  webCheckCompanyLicense,
};

