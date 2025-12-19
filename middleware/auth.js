// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect('/auth/login');
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.userId && req.session.userRole === 'admin') {
        return next();
    }
    res.status(403).send('Access denied. Admin privileges required.');
};

// Middleware to redirect to dashboard if already logged in
const redirectIfAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return res.redirect('/dashboard');
    }
    next();
};

module.exports = {
    isAuthenticated,
    isAdmin,
    redirectIfAuthenticated
};

