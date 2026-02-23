const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');

// Login pages
router.get('/login-user_one', (req, res) => {
    res.render('login_user_one', { error: null });
});

router.get('/login-user_two', (req, res) => {
    res.render('login_user_two', { error: null });
});

// Auth logic
router.post('/login-user_one', async (req, res) => {
    const { email, password } = req.body;
    console.log(`[Auth] Attempt login for: ${email} (Route: login-user_one)`);
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            console.log(`[Auth] User not found: ${email}`);
            return res.render('login_user_one', { error: 'Credenciais inválidas' });
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
            res.render('login_user_one', { error: 'Credenciais inválidas' });
        }
    } catch (err) {
        console.error(`[Auth] Error during login:`, err);
        res.render('login_user_one', { error: 'Erro no servidor' });
    }
});

router.post('/login-user_two', async (req, res) => {
    const { email, password } = req.body;
    console.log(`[Auth] Attempt login for: ${email} (Route: login-user_two)`);
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            console.log(`[Auth] User not found: ${email}`);
            return res.render('login_user_two', { error: 'Credenciais inválidas' });
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
            res.render('login_user_two', { error: 'Credenciais inválidas' });
        }
    } catch (err) {
        console.error(`[Auth] Error during login:`, err);
        res.render('login_user_two', { error: 'Erro no servidor' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login-user_one');
});

module.exports = router;
