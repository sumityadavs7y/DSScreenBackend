/**
 * Example Routes - Demonstrating how to use the authentication middleware
 * 
 * This file shows various examples of protected routes with company context
 */

const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/sessionAuth');
const verifyToken = protect; // Alias for compatibility
const optionalAuth = (req, res, next) => next(); // Optional auth not needed for sessions

/**
 * Example 1: Basic Protected Route
 * Requires authentication, accessible by all authenticated users
 */
router.get('/protected-data', verifyToken, async (req, res) => {
  // At this point:
  // - req.user contains the authenticated user
  // - req.company contains the company context (from JWT)
  // - req.userCompany contains the user's role and permissions in this company
  // - req.tokenPayload contains the decoded JWT payload

  res.json({
    success: true,
    message: 'This is protected data',
    data: {
      user: req.user.toSafeObject(),
      companyName: req.company.name,
      userRole: req.userCompany.role,
      // IMPORTANT: Company context comes from JWT, not from request
      // This ensures users can't access other companies' data
    },
  });
});

/**
 * Example 2: Role-Based Access Control
 * Only owners and admins can access this endpoint
 */
router.post('/admin-action', 
  verifyToken, 
  requireRole('owner', 'admin'), 
  async (req, res) => {
    // Only users with 'owner' or 'admin' role in this company can access
    
    res.json({
      success: true,
      message: 'Admin action performed',
      performedBy: req.user.email,
      company: req.company.name,
    });
  }
);

/**
 * Example 3: Owner-Only Action
 * Only company owners can access this endpoint
 */
router.delete('/company-settings', 
  verifyToken, 
  requireRole('owner'), 
  async (req, res) => {
    // Only owners can access this endpoint
    
    res.json({
      success: true,
      message: 'Company settings updated',
      company: req.company.name,
    });
  }
);

/**
 * Example 4: Optional Authentication
 * Works with or without authentication
 * Useful for public endpoints that can provide extra features for authenticated users
 */
router.get('/public-products', optionalAuth, async (req, res) => {
  let products;
  
  if (req.company) {
    // User is authenticated - show company-specific products
    products = await getCompanyProducts(req.company.id);
  } else {
    // User is not authenticated - show public products
    products = await getPublicProducts();
  }
  
  res.json({
    success: true,
    data: products,
  });
});

/**
 * Example 5: Creating Company-Specific Data
 * Shows how to properly scope data to the company context
 */
router.post('/items', verifyToken, async (req, res) => {
  const { name, description, price } = req.body;
  
  // IMPORTANT: Always use company ID from req.company (from JWT)
  // NEVER trust company ID from request body - this prevents users from
  // creating data in companies they don't belong to
  
  const item = await createItem({
    name,
    description,
    price,
    companyId: req.company.id, // From JWT token, not from request
    createdBy: req.user.id,
  });
  
  res.json({
    success: true,
    message: 'Item created successfully',
    data: item,
  });
});

/**
 * Example 6: Querying Company-Specific Data
 * Shows how to properly filter data by company context
 */
router.get('/items', verifyToken, async (req, res) => {
  // IMPORTANT: Always filter by company ID from req.company
  // This ensures users only see data from their current company context
  
  const items = await getItems({
    companyId: req.company.id, // From JWT token
    // ... other filters from query params
  });
  
  res.json({
    success: true,
    data: items,
  });
});

/**
 * Example 7: Updating Company-Specific Data
 * Shows proper authorization checks
 */
router.put('/items/:itemId', verifyToken, async (req, res) => {
  const { itemId } = req.params;
  const { name, description, price } = req.body;
  
  // First, verify the item belongs to the user's current company
  const item = await getItemById(itemId);
  
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Item not found',
    });
  }
  
  // CRITICAL: Verify item belongs to the company from JWT
  if (item.companyId !== req.company.id) {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this item',
    });
  }
  
  // Optionally check role-based permissions
  if (item.createdBy !== req.user.id && !['owner', 'admin'].includes(req.userCompany.role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to edit this item',
    });
  }
  
  // Update the item
  const updatedItem = await updateItem(itemId, { name, description, price });
  
  res.json({
    success: true,
    message: 'Item updated successfully',
    data: updatedItem,
  });
});

/**
 * Example 8: Custom Permission Check
 * Shows how to implement granular permissions
 */
router.post('/sensitive-action', verifyToken, async (req, res) => {
  // Check custom permission in the userCompany permissions object
  const hasPermission = req.userCompany.permissions?.canPerformSensitiveAction === true;
  
  if (!hasPermission && !['owner', 'admin'].includes(req.userCompany.role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action',
    });
  }
  
  // Perform sensitive action
  
  res.json({
    success: true,
    message: 'Sensitive action performed',
  });
});

/**
 * Example 9: Audit Trail
 * Shows how to log actions with user and company context
 */
router.post('/important-action', verifyToken, async (req, res) => {
  // Perform action
  const result = await performImportantAction(req.body);
  
  // Log the action with full context
  await createAuditLog({
    action: 'important_action',
    userId: req.user.id,
    companyId: req.company.id,
    userRole: req.userCompany.role,
    details: req.body,
    ipAddress: req.ip,
    timestamp: new Date(),
  });
  
  res.json({
    success: true,
    message: 'Action performed and logged',
    data: result,
  });
});

/**
 * Example 10: Multi-Company Data Aggregation
 * Shows how to get data across all companies user has access to
 */
router.get('/my-data-across-companies', verifyToken, async (req, res) => {
  // Get all companies the user has access to
  const { UserCompany } = require('../models');
  
  const userCompanies = await UserCompany.findAll({
    where: {
      userId: req.user.id,
      isActive: true,
    },
  });
  
  const companyIds = userCompanies.map(uc => uc.companyId);
  
  // Get data from all companies
  const data = await getDataFromCompanies(companyIds);
  
  res.json({
    success: true,
    data,
  });
});

// Placeholder functions (implement these based on your models)
async function getCompanyProducts(companyId) {
  // Your implementation
  return [];
}

async function getPublicProducts() {
  // Your implementation
  return [];
}

async function createItem(itemData) {
  // Your implementation
  return itemData;
}

async function getItems(filter) {
  // Your implementation
  return [];
}

async function getItemById(itemId) {
  // Your implementation
  return null;
}

async function updateItem(itemId, updates) {
  // Your implementation
  return updates;
}

async function performImportantAction(data) {
  // Your implementation
  return data;
}

async function createAuditLog(logData) {
  // Your implementation
  return logData;
}

async function getDataFromCompanies(companyIds) {
  // Your implementation
  return [];
}

module.exports = router;

