const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');

// Login page
router.get('/access/login', (req, res) => {
    res.render('auth/login', { error: null });
});

// Login logic
router.post('/access/login', async (req, res) => {
    let { email, password, accessCode } = req.body;

    // Normalization
    email = email ? email.trim() : '';
    password = password ? password.trim() : '';
    accessCode = accessCode ? accessCode.trim() : '';

    console.log(`[Auth] Unified login attempt for: ${email}`);

    // Secret Code Validation
    if (accessCode !== '2025') {
        console.log(`[Auth] Invalid access code attempt: ${accessCode}`);
        return res.render('auth/login', { error: 'Código de acesso inválido.' });
    }

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            console.log(`[Auth] User not found: ${email}`);
            return res.render('auth/login', { error: 'Credenciais inválidas.' });
        }

        const match = await bcrypt.compare(password, user.password);
        console.log(`[Auth] Password match for ${email}: ${match}`);

        if (match) {
            req.session.userId = user.id;
            const domain = process.env.DOMAIN || 'mozcompras.store';
            const isProd = process.env.developmentenviroment === 'production';

            if (isProd) {
                const redirectUrl = `https://mydashboard.${domain}/`;
                console.log(`[Auth] Redirecting to production dashboard: ${redirectUrl}`);
                return res.redirect(redirectUrl);
            }

            console.log(`[Auth] Redirecting to local dashboard: /dashboard`);
            res.redirect('/dashboard');
        } else {
            res.render('auth/login', { error: 'Credenciais inválidas.' });
        }
    } catch (err) {
        console.error(`[Auth] Error during login:`, err);
        res.render('auth/login', { error: 'Erro no servidor.' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth/access/login');
});

module.exports = router;
