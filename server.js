const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware (Static Assets first)
app.use(express.static(path.join(__dirname, 'public')));

// Subdomain Enforcement Middleware
const { enforceSubdomains } = require('./middleware/subdomain');
app.use(enforceSubdomains);

// Other Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global Middleware for Scripts (Pixel/Utmify)
app.use((req, res, next) => {
    // In a real app, these might come from a DB or file. 
    // Here we mock them or load from a simple JSON if implemented.
    // For now, passing empty strings or env vars.
    res.locals.pixelId = process.env.PIXEL_ID || '';
    res.locals.utmifyId = process.env.UTMIFY_ID || '';

    // Gatilhos globais de vendas
    res.locals.gatilhoTimer = process.env.GATILHO_TIMER === 'true';
    res.locals.gatilhoDesconto = process.env.GATILHO_DESCONTO || 'off';

    next();
});

// Routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const checkoutRoutes = require('./routes/checkout');
const saqueRoutes = require('./routes/saque');

const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET || 'gfg_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using https
}));

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/', checkoutRoutes);
app.use('/saque', saqueRoutes);

const sequelize = require('./config/database');
// Import models to ensure they are registered with Sequelize before sync
require('./models/User');
require('./models/Product');
require('./models/Sale');
require('./models/Withdrawal');
require('./models/CheckoutSession');

sequelize.sync({ alter: true }).then(async () => {
    console.log('Database synchronized successfully.');

    // Create initial users from .env if they don't exist
    const User = require('./models/User');
    if (process.env.USER_ONE_EMAIL) {
        await User.findOrCreate({
            where: { email: process.env.USER_ONE_EMAIL },
            defaults: {
                name: 'User One',
                password: process.env.USER_ONE_PASS || '123456',
                role: 'vendor'
            }
        });
    }
    if (process.env.USER_TWO_EMAIL) {
        await User.findOrCreate({
            where: { email: process.env.USER_TWO_EMAIL },
            defaults: {
                name: 'User Two',
                password: process.env.USER_TWO_PASS || '123456',
                role: 'vendor'
            }
        });
    }

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
