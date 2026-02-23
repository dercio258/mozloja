const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register page
router.get('/register', (req, res) => {
    res.render('auth/register', { error: null });
});

// Register logic
router.post('/register', async (req, res) => {
    let { name, email, password, accessCode } = req.body;

    // Normalization
    name = name ? name.trim() : '';
    email = email ? email.trim() : '';
    password = password ? password.trim() : '';
    accessCode = accessCode ? accessCode.trim() : '';

    // Simple Secret Code Validation
    if (accessCode !== '2025') {
        return res.render('auth/register', { error: 'Código de acesso inválido.' });
    }

    if (!name || !email || !password) {
        return res.render('auth/register', { error: 'Todos os campos são obrigatórios.' });
    }

    try {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.render('auth/register', { error: 'Email já cadastrado.' });
        }

        const newUser = await User.create({
            name,
            email,
            password,
            role: 'vendor'
        });

        req.session.userId = newUser.id;

        const domain = process.env.DOMAIN || 'mozcompras.store';
        const isProd = process.env.developmentenviroment === 'production';
        if (isProd) {
            return res.redirect(`https://mydashboard.${domain}/`);
        }
        res.redirect('/dashboard');
    } catch (err) {
        console.error('[Register Error]:', err);
        res.render('auth/register', { error: 'Erro ao criar conta.' });
    }
});

module.exports = router;
