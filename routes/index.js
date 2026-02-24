const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Withdrawal = require('../models/Withdrawal');
const CheckoutSession = require('../models/CheckoutSession');
const crypto = require('crypto');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', (req, res) => {
    const domain = process.env.DOMAIN || 'mozcompras.store';
    const baseUrl = process.env.developmentenviroment === 'production'
        ? `https://${domain}`
        : `http://localhost:${process.env.PORT || 3000}`;

    res.render('index', {
        products: [],
        baseUrl
    });
});

// Robust checkout initialization
router.get('/checkout/init/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const token = crypto.randomBytes(16).toString('hex'); // 32 chars alphanumeric
        const expireHours = parseFloat(process.env.Time_checkout_expire || '1');
        const expiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000);

        // Check if it's a mock product
        const isMock = ['101', '102', '103'].includes(productId);

        await CheckoutSession.create({
            token,
            productId,
            isMock,
            expiresAt,
            used: false
        });

        // Robust redirect URL: /c/{token}
        res.redirect(`/c/${token}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating checkout session');
    }
});

router.get('/loja', async (req, res) => {
    try {
        // Mock products as requested
        const mockProducts = [
            {
                id: 101,
                name: 'Curso de Marketing Digital',
                price: 197.00,
                image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
                description: 'Aprenda as melhores estratégias para vender online e alavancar seu negócio.'
            },
            {
                id: 102,
                name: 'Mentoria Exclusiva de Vendas',
                price: 497.00,
                image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
                description: 'Receba orientação direta dos maiores especialistas do mercado moçambicano.'
            },
            {
                id: 103,
                name: 'E-book: Segredos do Tráfego Pago',
                price: 250.00,
                image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
                description: 'Descubra como dominar o tráfego pago e atrair milhares de clientes qualificados.'
            }
        ];

        // Show ONLY mock products
        const allProducts = [...mockProducts];

        const baseUrl = process.env.developmentenviroment === 'production'
            ? 'https://pay.mozcompras.store'
            : `http://localhost:${process.env.PORT || 3000}`;

        res.render('store', { products: allProducts, baseUrl });
    } catch (err) {
        console.error(err);
        res.render('store', { products: [], baseUrl: '' });
    }
});

router.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const sales = await Sale.findAll({ where: { vendedor_id: req.user.id } });
        const withdrawals = await Withdrawal.findAll({ where: { vendedor_id: req.user.id } });

        let totalRevenue = 0;
        let revenueToday = 0;
        let revenueYesterday = 0;
        let revenue7d = 0;
        let revenue30d = 0;
        let balance = 0;

        let countSuccess = 0;
        let countPending = 0;
        let countFailed = 0;

        const now = new Date();
        const startOfDate = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

        const todayNum = startOfDate(now);
        const yesterdayNum = todayNum - (24 * 60 * 60 * 1000);
        const sevenDaysAgo = todayNum - (7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = todayNum - (30 * 24 * 60 * 60 * 1000);

        const last7DaysMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(todayNum - (i * 24 * 60 * 60 * 1000));
            const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
            last7DaysMap[dateStr] = 0;
        }

        const last30DaysMap = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(todayNum - (i * 24 * 60 * 60 * 1000));
            const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
            last30DaysMap[dateStr] = 0;
        }

        const todayHourlyMap = {};
        const yesterdayHourlyMap = {};
        for (let i = 0; i <= 23; i++) {
            const hourStr = `${i}h`;
            todayHourlyMap[hourStr] = 0;
            yesterdayHourlyMap[hourStr] = 0;
        }

        sales.forEach(sale => {
            if (!sale.createdAt) return;
            const saleDate = new Date(sale.createdAt);
            const saleTime = startOfDate(saleDate);
            const saleHourStr = `${saleDate.getHours()}h`;

            if (sale.status === 'Concluído') {
                countSuccess++;
                totalRevenue += sale.amount;
                balance += sale.amount;

                if (saleTime === todayNum) {
                    revenueToday += sale.amount;
                    todayHourlyMap[saleHourStr] += sale.amount;
                }
                if (saleTime === yesterdayNum) {
                    revenueYesterday += sale.amount;
                    yesterdayHourlyMap[saleHourStr] += sale.amount;
                }
                if (saleTime >= sevenDaysAgo) {
                    revenue7d += sale.amount;
                    const dateStr = `${saleDate.getDate()}/${saleDate.getMonth() + 1}`;
                    if (last7DaysMap[dateStr] !== undefined) {
                        last7DaysMap[dateStr] += sale.amount;
                    }
                }
                if (saleTime >= thirtyDaysAgo) {
                    revenue30d += sale.amount;
                    const dateStr = `${saleDate.getDate()}/${saleDate.getMonth() + 1}`;
                    if (last30DaysMap[dateStr] !== undefined) {
                        last30DaysMap[dateStr] += sale.amount;
                    }
                }

            } else if (sale.status === 'Pendente') {
                countPending++;
            } else {
                countFailed++;
            }
        });

        withdrawals.forEach(wd => {
            if (wd.status === 'Concluído') {
                balance -= wd.amount;
            }
        });

        res.render('dashboard', {
            balance,
            totalRevenue,
            revenueToday,
            revenueYesterday,
            revenue7d,
            revenue30d,
            countSuccess,
            countPending,
            countFailed,
            chartLabels: JSON.stringify(Object.keys(last7DaysMap)),
            chartData: JSON.stringify(Object.values(last7DaysMap)),
            chartLabelsToday: JSON.stringify(Object.keys(todayHourlyMap)),
            chartDataToday: JSON.stringify(Object.values(todayHourlyMap)),
            chartLabelsYesterday: JSON.stringify(Object.keys(yesterdayHourlyMap)),
            chartDataYesterday: JSON.stringify(Object.values(yesterdayHourlyMap)),
            chartLabels30d: JSON.stringify(Object.keys(last30DaysMap)),
            chartData30d: JSON.stringify(Object.values(last30DaysMap))
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading dashboard');
    }
});

router.get('/products', isAuthenticated, async (req, res) => {
    try {
        const products = await Product.findAll({ where: { vendedor_id: req.user.id } });
        const baseUrl = process.env.developmentenviroment === 'production'
            ? 'https://produtos.mozcompras.store'
            : `http://localhost:${process.env.PORT || 3000}`;
        res.render('products', { products, baseUrl });
    } catch (err) {
        console.error(err);
        res.render('products', { products: [] });
    }
});

router.get('/products/new', isAuthenticated, (req, res) => {
    res.render('create_product');
});

router.post('/products', isAuthenticated, async (req, res) => {
    try {
        const { name, price, image, description, content_link, pixel_id, utmify_id, webhook_url } = req.body;
        await Product.create({
            name,
            price: parseFloat(price),
            image,
            description,
            content_link,
            pixel_id: pixel_id || null,
            utmify_id: utmify_id || null,
            webhook_url: webhook_url || null,
            vendedor_id: req.user.id
        });
        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating product');
    }
});

router.post('/products/update-integrations/:productId', isAuthenticated, async (req, res) => {
    try {
        const { productId } = req.params;
        const { pixel_id, utmify_id, webhook_url } = req.body;

        await Product.update({
            pixel_id: pixel_id || null,
            utmify_id: utmify_id || null,
            webhook_url: webhook_url || null
        }, {
            where: { id: productId, vendedor_id: req.user.id }
        });

        res.redirect('/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating product integrations');
    }
});

router.get('/sales', isAuthenticated, async (req, res) => {
    try {
        const sales = await Sale.findAll({
            where: { vendedor_id: req.user.id },
            order: [['createdAt', 'DESC']]
        });
        res.render('sales', { sales });
    } catch (err) {
        console.error(err);
        res.render('sales', { sales: [] });
    }
});

router.get('/thank-you/:saleId', async (req, res) => {
    try {
        const { saleId } = req.params;
        const sale = await Sale.findByPk(saleId);

        if (!sale) {
            return res.redirect('/thank-you-generic'); // Fallback if sale not found
        }

        let productLink = '#';
        let productName = sale.product;

        if (sale.productId) {
            // Check if mock product
            const mockLinks = {
                '101': 'https://mega.nz/file/mock-curso-mkt',
                '102': 'https://mega.nz/file/mock-mentoria',
                '103': 'https://mega.nz/file/mock-ebook'
            };

            if (mockLinks[sale.productId]) {
                productLink = mockLinks[sale.productId];
            } else {
                const product = await Product.findByPk(sale.productId);
                if (product) {
                    productLink = product.content_link;
                    productName = product.name;
                }
            }
        }

        res.render('thank_you', { productName, productLink });
    } catch (err) {
        console.error(err);
        res.render('thank_you', { productName: 'Produto', productLink: '#' });
    }
});

router.post('/support/send', (req, res) => {
    try {
        const { name, email, message } = req.body;
        console.log(`[Support Request] From: ${name} (${email}) - Message: ${message}`);
        // In a real app, send an email here
        res.json({ success: true, message: 'Sua mensagem foi enviada com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Erro ao enviar mensagem.' });
    }
});

module.exports = router;
