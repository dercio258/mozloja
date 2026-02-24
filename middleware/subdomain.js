/**
 * Middleware to enforce subdomains and rewrite URLs for root-level subdomain access.
 */

const enforceSubdomains = (req, res, next) => {
    const isProd = process.env.developmentenviroment === 'production';
    const domain = process.env.DOMAIN || 'mozcompras.store';

    // Always make url helper available
    res.locals.url = (sub, path = '/') => {
        if (!isProd) return path;
        if (!sub || sub === 'home') return `https://${domain}${path}`;
        return `https://${sub}.${domain}${path}`;
    };

    if (!isProd) return next();

    const host = req.hostname.toLowerCase();
    const path = req.path;

    // Skip middleware for static assets
    const isStatic = path.startsWith('/css/') ||
        path.startsWith('/js/') ||
        path.startsWith('/images/') ||
        path.includes('.pixel.js') ||
        path === '/favicon.ico';

    if (isStatic) return next();

    const currentSub = host.split('.')[0];
    const hasSubdomain = host.split('.').length > 2;

    // 0. Global Paths: Redirect back to main domain if on a subdomain
    const globalPaths = ['/auth', '/support', '/new_user'];
    const isGlobal = globalPaths.some(p => path.startsWith(p));

    if (hasSubdomain && isGlobal) {
        const query = req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '';
        return res.redirect(`https://${domain}${path}${query}`);
    }

    // Subdomain to Path mapping (for URL rewriting)
    const subToPath = {
        'loja': '/loja',
        'pay': '/c',
        'app': '/dashboard',
        'vendas': '/sales',
        'produtos': '/products',
        'financeiro': '/saque',
        'novo-produto': '/products/new',
        'obrigado': '/thank-you'
    };

    // Path to Subdomain mapping (for Enforcement)
    const pathToSub = {
        '/loja': 'loja',
        '/dashboard': 'app',
        '/sales': 'vendas',
        '/products': 'produtos',
        '/saque': 'financeiro',
        '/products/new': 'novo-produto'
    };

    // Special cases for enforcement
    let expectedSub = pathToSub[path];

    // Explicitly handle checkout initialization on 'loja'
    if (path.startsWith('/checkout/init')) {
        expectedSub = 'loja';
    }
    // And actual checkout pages on 'pay'
    else if (path.startsWith('/c/') || path.startsWith('/checkout')) {
        expectedSub = 'pay';
    } else if (path.startsWith('/thank-you/')) {
        expectedSub = 'obrigado';
    }

    // 1. Enforcement: Redirect if accessing a specific path on the wrong subdomain
    if (expectedSub) {
        if (!hasSubdomain || currentSub !== expectedSub) {
            // If we are moving to the root of a subdomain, we can strip the path
            // e.g., /dashboard -> mydashboard.domain/
            // But for /thank-you/ID, we need to keep the ID part relative to the root?
            // Actually, if we use the subdomain as the "app", then the path becomes relative.
            let targetPath = '/';
            if (path.startsWith('/thank-you/')) targetPath = path.replace('/thank-you', '');
            if (path.startsWith('/c/')) targetPath = path.replace('/c', '/c'); // keep it?
            if (path.startsWith('/checkout/')) targetPath = path.replace('/checkout', '/checkout');

            // For simple paths like /dashboard, just go to root
            if (pathToSub[path]) targetPath = '/';

            return res.redirect(`https://${expectedSub}.${domain}${targetPath}`);
        }
    }

    // 2. URL Rewriting: If on a designated subdomain, prepend the base path if missing
    if (hasSubdomain && subToPath[currentSub]) {
        const basePath = subToPath[currentSub];
        if (path === '/') {
            req.url = basePath;
        } else if (!path.startsWith(basePath)) {
            // Join base path and current path, ensuring no double slashes
            req.url = basePath + (path.startsWith('/') ? path : '/' + path);
        }
        return next();
    }

    // 3. Prevent cross-access: Redirect to main domain if at root of non-matching subdomain
    if (path === '/' && hasSubdomain && currentSub !== 'www' && currentSub !== 'home' && !subToPath[currentSub]) {
        return res.redirect(`https://${domain}/`);
    }

    next();
};

module.exports = { enforceSubdomains };
