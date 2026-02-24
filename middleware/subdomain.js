/**
 * Middleware to enforce subdomains and rewrite URLs for root-level subdomain access.
 */

const enforceSubdomains = (req, res, next) => {
    // Always make url helper available - returns only path since subdomains are removed
    res.locals.url = (sub, path = '/') => {
        const mapping = {
            'app': '/dashboard',
            'vendas': '/sales',
            'produtos': '/products',
            'financeiro': '/saque',
            'novo-produto': '/products/new',
            'integrations': '/products',
            'loja': '/loja',
            'pay': '/c',
            'obrigado': '/thank-you',
            'home': '/'
        };
        // If the first argument matches a mapping, return that path.
        // If it's a specific path already (starts with /), return it.
        // Otherwise return the path argument.
        return mapping[sub] || path;
    };

    next();
};

module.exports = { enforceSubdomains };
