const express = require('express');
const router = express.Router();

// Login pages
router.get('/login-user_one', (req, res) => {
    res.render('login_user_one', { error: null });
});

router.get('/login-user_two', (req, res) => {
    res.render('login_user_two', { error: null });
});

// Auth logic
router.post('/login-user_one', (req, res) => {
    const { email, password } = req.body;
    if (email === process.env.USER_ONE_EMAIL && password === process.env.USER_ONE_PASS) {
        // Set session or cookie in real app. Redirecting to dashboard for now.
        res.redirect('/dashboard?user=one');
    } else {
        res.render('login_user_one', { error: 'Invalid credentials' });
    }
});

router.post('/login-user_two', (req, res) => {
    const { email, password } = req.body;
    if (email === process.env.USER_TWO_EMAIL && password === process.env.USER_TWO_PASS) {
        res.redirect('/dashboard?user=two');
    } else {
        res.render('login_user_two', { error: 'Invalid credentials' });
    }
});

module.exports = router;
