const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Login page
router.get('/access/login', (req, res) => {
    res.render('auth/login', { error: null });
});

// Login logic
router.post('/access/login', async (req, res) => {
    let { email, password } = req.body;

    // Normalization
    email = email ? email.trim() : '';
    password = password ? password.trim() : '';

    console.log(`[Auth] Unified login attempt for: ${email}`);

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
                return res.redirect('/dashboard');
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
