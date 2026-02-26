const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const CheckoutSession = require('../models/CheckoutSession');
const paymentService = require('../services/paymentService');
const utmTracking = require('../utils/utmTracking');

router.get('/c/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const session = await CheckoutSession.findOne({ where: { token, used: false } });

        if (!session) {
            return res.status(404).render('error', { message: 'Sessão de checkout expirada ou não encontrada.' });
        }

        if (new Date() > session.expiresAt) {
            return res.status(410).render('error', { message: 'Sessão de checkout expirada.' });
        }

        let product;
        if (session.isMock) {
            const mockProducts = {
                '101': {
                    id: 101,
                    name: 'Curso de Marketing Digital',
                    price: 197.00,
                    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
                    pixel_id: '11111111111',
                    utmify_id: 'token-mock-1'
                },
                '102': {
                    id: 102,
                    name: 'Mentoria Exclusiva de Vendas',
                    price: 497.00,
                    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
                    pixel_id: '22222222222',
                    utmify_id: 'token-mock-2'
                },
                '103': {
                    id: 103,
                    name: 'E-book: Segredos do Tráfego Pago',
                    price: 250.00,
                    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
                    pixel_id: '33333333333',
                    utmify_id: 'token-mock-3'
                }
            };
            product = mockProducts[session.productId];
        } else {
            product = await Product.findByPk(session.productId);
        }

        if (!product) {
            return res.status(404).render('error', { message: 'Produto não encontrado.' });
        }

        res.render('checkout', {
            product: product,
            sessionToken: token
        });
    } catch (err) {
        console.error('Checkout GET error:', err);
        res.status(500).send('Erro interno ao carregar checkout');
    }
});

router.post('/process', async (req, res) => {
    try {
        const { amount, phone, provider, name, email, productId, sessionToken } = req.body;

        // Capture UTM parameters from request
        const trackingParams = utmTracking.captureUTMParameters({
            reqBody: req.body,
            reqQuery: req.query,
            ip: req.ip || req.get('x-forwarded-for') || req.connection.remoteAddress
        });

        // Call payment service with customer data
        const result = await paymentService.processPayment(provider, phone, amount, null, { name, email, phone });

        let productDetails = null;
        if (productId == '101') {
            productDetails = { id: 101, name: 'Curso de Marketing Digital' };
        } else if (productId == '102') {
            productDetails = { id: 102, name: 'Mentoria Exclusiva de Vendas' };
        } else if (productId == '103') {
            productDetails = { id: 103, name: 'E-book: Segredos do Tráfego Pago' };
        } else if (productId) {
            productDetails = await Product.findByPk(productId);
        }

        if (result.success) {
            const saleId = `SALE-${Date.now()}`;
            // Use transaction_id or fallback to reference from data
            const externalRef = result.transaction_id || result.data?.id || result.data?.reference;

            await Sale.create({
                id: saleId,
                product: productDetails ? productDetails.name : 'Venda Avulsa',
                customer: name || 'Cliente Anónimo',
                email: email || null,
                phone: phone || null,
                amount: parseFloat(amount),
                status: 'Pendente',
                vendedor_id: productDetails ? productDetails.vendedor_id : null,
                productId: productDetails ? (productDetails.id || productId) : null,
                external_reference: externalRef ? externalRef.toString() : null
            });

            // Mark session as used
            if (sessionToken) {
                await CheckoutSession.update({ used: true }, { where: { token: sessionToken } });
            }

            return res.json({
                success: true,
                saleId: saleId,
                message: 'Pedido enviado! Confirme no seu telemóvel.',
                redirect: `/thank-you/${saleId}`
            });
        } else {
            return res.json({ success: false, error: (result.message || result.error || 'Erro no pagamento') });
        }
    } catch (err) {
        console.error(err);
        return res.json({ success: false, error: 'Ocorreu um erro interno no servidor.' });
    }
});

module.exports = router;
