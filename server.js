const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/', checkoutRoutes);
app.use('/saque', saqueRoutes);

const sequelize = require('./config/database');
// Import models to ensure they are registered with Sequelize before sync
require('./models/Product');
require('./models/Sale');
require('./models/Withdrawal');
require('./models/CheckoutSession');

sequelize.sync({ alter: true }).then(() => {
    console.log('Database synchronized successfully.');
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
