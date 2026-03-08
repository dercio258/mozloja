const User = require('../models/User');

const isAuthenticated = async (req, res, next) => {
    if (req.session && req.session.userId) {
        try {
            const user = await User.findByPk(req.session.userId);
            if (user) {
                req.user = user;
                res.locals.user = user; // Make user available to EJS templates
                return next();
            }
            console.log(`[Auth Middleware] User not found for ID: ${req.session.userId}`);
        } catch (err) {
            console.error('[Auth Middleware] Database error:', err);
        }
    } else {
        console.log(`[Auth Middleware] No session or userId found. Session: ${!!req.session}, UserID: ${req.session?.userId}`);
    }

    // Check if it's an AJAX request or if redirection is needed
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const loginUrl = '/auth/access/login';

    res.redirect(loginUrl); // Redirecting to the discrete login page
};

module.exports = { isAuthenticated };
