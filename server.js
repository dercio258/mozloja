const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const { enforceSubdomains } = require('./middleware/subdomain');
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const checkoutRoutes = require('./routes/checkout');
const saqueRoutes = require('./routes/saque');
const sequelize = require('./config/database');

// Import models to ensure they are registered with Sequelize
require('./models/User');
require('./models/Product');
require('./models/Sale');
require('./models/Withdrawal');
require('./models/CheckoutSession');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (Static Assets first)
app.use(express.static(path.join(__dirname, 'public')));

// Subdomain Enforcement Middleware
app.use(enforceSubdomains);

// Other Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global Middleware for Scripts (Pixel/Utmify)
app.use((req, res, next) => {
    res.locals.pixelId = process.env.PIXEL_ID || '';
    res.locals.utmifyId = process.env.UTMIFY_ID || '';
    res.locals.gatilhoTimer = process.env.GATILHO_TIMER === 'true';
    res.locals.gatilhoDesconto = process.env.GATILHO_DESCONTO || 'off';
    next();
});

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'gfg_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using https
}));

// Routes
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/', checkoutRoutes);
app.use('/saque', saqueRoutes);

sequelize.sync({ alter: true }).then(async () => {
    console.log('Database synchronized successfully.');

    // Create initial users from .env if they don't exist
    const User = require('./models/User');
    const usersToCreate = [
        { email: process.env.USER_ONE_EMAIL, name: 'User One', pass: process.env.USER_ONE_PASS || '123456' },
        { email: process.env.USER_TWO_EMAIL, name: 'User Two', pass: process.env.USER_TWO_PASS || '123456' }
    ];

    for (const u of usersToCreate) {
        if (u.email) {
            const [user, created] = await User.findOrCreate({
                where: { email: u.email },
                defaults: {
                    name: u.name,
                    password: u.pass,
                    role: 'vendor'
                }
            });

            // If the user already existed, verify if the password matches the .env value
            // This handles cases where .env was changed or initial hashing was skipped
            if (!created) {
                const bcrypt = require('bcrypt');
                const isMatch = await bcrypt.compare(u.pass, user.password);

                if (!isMatch) {
                    console.log(`[Server] Password mismatch for ${u.email}. Updating DB to match .env and re-hashing...`);
                    user.password = u.pass;
                    await user.save(); // This triggers beforeUpdate hook in User model
                }
            } else {
                console.log(`[Server] Created initial user: ${u.email}`);
            }
        }
    }

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
