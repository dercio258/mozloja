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
        } catch (err) {
            console.error('Auth middleware error:', err);
        }
    }

    // Check if it's an AJAX request or if redirection is needed
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    res.redirect('/auth/login-user_one'); // Redirecting to one of the login pages by default
};

module.exports = { isAuthenticated };
