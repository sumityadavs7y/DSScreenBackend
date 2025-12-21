const express = require('express');
const path = require('path');
const router = express.Router();

// Home page - Device Registration
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Login page
router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Register page
router.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/register.html'));
});

// Company selection page
router.get('/company-selection', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/company-selection.html'));
});

// Dashboard page
router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// API info endpoint (for developers)
router.get('/api', (req, res) => {
    res.json({
        status: 'success',
        message: 'dsScreen Backend API - Multi-Tenant Authentication',
        version: '1.0.0',
        documentation: {
            authentication: 'See AUTHENTICATION.md for detailed auth documentation',
            quickstart: 'See QUICKSTART.md for setup instructions'
        },
        endpoints: {
            health: '/health',
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                selectCompany: 'POST /api/auth/select-company (requires tempToken)',
                logout: 'POST /api/auth/logout (requires accessToken)',
                me: 'GET /api/auth/me (requires accessToken)',
                companies: 'GET /api/auth/companies (requires accessToken)',
                switchCompany: 'POST /api/auth/switch-company (requires accessToken)',
                refresh: 'POST /api/auth/refresh (requires refreshToken)'
            },
            company: {
                info: 'GET /api/company/info (requires accessToken)',
                updateInfo: 'PUT /api/company/info (requires accessToken, owner/admin)',
                members: 'GET /api/company/members (requires accessToken)',
                addMember: 'POST /api/company/members/add (requires accessToken, owner/admin)',
                addMemberById: 'POST /api/company/members/add-by-id (requires accessToken, owner/admin)',
                updateRole: 'PUT /api/company/members/:userId/role (requires accessToken, owner/admin)',
                updatePermissions: 'PUT /api/company/members/:userId/permissions (requires accessToken, owner/admin)',
                removeMember: 'DELETE /api/company/members/:userId (requires accessToken, owner/admin)'
            },
            users: {
                create: 'POST /api/users/create (requires accessToken, owner/admin) - Create user and optionally add to company',
                search: 'GET /api/users/search?email=query (requires accessToken, owner/admin) - Search users by email'
            }
        },
        authFlow: {
            step1: 'Register or Login → Get tempToken + list of companies',
            step2: 'Select Company → Get accessToken + refreshToken',
            step3: 'Use accessToken in Authorization header for all API calls',
            note: 'Company context is securely embedded in the JWT token'
        }
    });
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Video demo page
router.get('/demo/video', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/video-demo.html'));
});

// Favicon handler (prevent 404)
router.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

module.exports = router;

