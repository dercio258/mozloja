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
    try {
        const user = await User.findOne({ where: { email } });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user.id;
            // In local/dev, just /dashboard. In prod, use subdomain.
            const domain = process.env.DOMAIN || 'mozcompras.store';
            const isProd = process.env.developmentenviroment === 'production';
            if (isProd) {
                return res.redirect(`https://mydashboard.${domain}/`);
            }
            res.redirect('/dashboard');
        } else {
            res.render('login_user_one', { error: 'Credenciais inválidas' });
        }
    } catch (err) {
        console.error(err);
        res.render('login_user_one', { error: 'Erro no servidor' });
    }
});

router.post('/login-user_two', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user.id;
            const domain = process.env.DOMAIN || 'mozcompras.store';
            const isProd = process.env.developmentenviroment === 'production';
            if (isProd) {
                return res.redirect(`https://mydashboard.${domain}/`);
            }
            res.redirect('/dashboard');
        } else {
            res.render('login_user_two', { error: 'Credenciais inválidas' });
        }
    } catch (err) {
        console.error(err);
        res.render('login_user_two', { error: 'Erro no servidor' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login-user_one');
});

module.exports = router;
