/**
 * Middleware to enforce subdomains and rewrite URLs for root-level subdomain access.
 */

const enforceSubdomains = (req, res, next) => {
    // Always make url helper available - returns only path since subdomains are removed
    res.locals.url = (sub, path = '/') => {
        return path;
    };

    next();
};

module.exports = { enforceSubdomains };
