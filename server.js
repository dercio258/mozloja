const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const { enforceSubdomains } = require('./middleware/subdomain');
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const registerRoutes = require('./routes/register');
const checkoutRoutes = require('./routes/checkout');
const saqueRoutes = require('./routes/saque');
const pagamentoRoutes = require('./routes/pagamento');
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
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

// Trust proxy for production sessions behind Nginx/PM2
app.set('trust proxy', 1);

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
const isProd = process.env.developmentenviroment === 'production';
const domain = process.env.DOMAIN || 'mozcompras.store';

app.use(session({
    secret: process.env.SESSION_SECRET || 'gfg_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProd, // Set to true if using https
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Routes
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/new_user', registerRoutes);
app.use('/', checkoutRoutes);
app.use('/saque', saqueRoutes);
app.use('/api', pagamentoRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/admin', adminRoutes);

const socketService = require('./services/socketService');

sequelize.sync({ alter: true }).then(async () => {
    console.log('Database synchronized successfully.');

    const http = require('http');
    const server = http.createServer(app);
    
    // Initialize Socket.io
    socketService.init(server);

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        
        // Generate Admin Access Code for User Listing
        const adminCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        app.locals.adminAccessCode = adminCode;
        console.log('\n' + '='.repeat(40));
        console.log(`[ADMIN] User List Access Code: ${adminCode}`);
        console.log(`[ADMIN] URL: http://localhost:${PORT}/admin/users?code=${adminCode}`);
        console.log('='.repeat(40) + '\n');
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
