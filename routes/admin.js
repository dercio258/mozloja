const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/users', async (req, res) => {
    try {
        const { code } = req.query;
        const correctCode = req.app.locals.adminAccessCode;

        if (!code || code !== correctCode) {
            return res.status(403).send('<h1>Acesso Negado</h1><p>Código de acesso inválido ou em falta.</p>');
        }

        const users = await User.findAll({
            order: [['createdAt', 'DESC']]
        });

        res.render('admin_users', { users, adminAccessCode: correctCode });
    } catch (err) {
        console.error('Admin Users Route Error:', err);
        res.status(500).send('Erro interno ao buscar usuários.');
    }
});

// Impersonation Login
router.get('/login-as/:userId', async (req, res) => {
    try {
        const { code } = req.query;
        const { userId } = req.params;
        const correctCode = req.app.locals.adminAccessCode;

        if (!code || code !== correctCode) {
            return res.status(403).send('Acesso negado.');
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).send('Usuário não encontrado.');
        }

        // Set session to this user
        req.session.userId = user.id;
        console.log(`[ADMIN] Super Admin impersonating user: ${user.email} (ID: ${user.id})`);

        res.redirect('/dashboard');
    } catch (err) {
        console.error('Login-as Error:', err);
        res.status(500).send('Erro ao tentar entrar na conta.');
    }
});

module.exports = router;
