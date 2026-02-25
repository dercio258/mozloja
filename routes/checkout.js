const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const CheckoutSession = require('../models/CheckoutSession');
const utmifyService = require('../services/utmifyService');
const axios = require('axios'); // For webhooks
const { Op } = require('sequelize');

// Robust Endpoint
router.get('/c/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const session = await CheckoutSession.findOne({
            where: {
                token,
                used: false
            }
        });

        if (!session) {
            return res.status(403).send('Link de checkout inválido ou já utilizado.');
        }

        // We NO LONGER mark as used here. 
        // We only mark as used if the payment is successful in the POST route.
        // We also removed the expiration check (Op.gt: new Date()) as per "seckout nunca deve expirar para usuario que nao tersminou o pagamento"

        let product = null;
        if (session.isMock) {
            // Mock products logic
            if (session.productId == '101') {
                product = { id: 101, name: 'Curso de Marketing Digital', price: 197.00, image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' };
            } else if (session.productId == '102') {
                product = { id: 102, name: 'Mentoria Exclusiva de Vendas', price: 497.00, image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' };
            } else if (session.productId == '103') {
                product = { id: 103, name: 'E-book: Segredos do Tráfego Pago', price: 250.00, image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60' };
            }
        } else {
            product = await Product.findByPk(session.productId);
        }

        if (!product) {
            return res.status(404).send('Produto não encontrado.');
        }

        res.render('checkout', {
            amount: product.price,
            product: product,
            sessionToken: token // Pass the token to be used in the POST form
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro interno ao carregar checkout.');
    }
});


router.post('/process', async (req, res) => {
    try {
        const { amount, phone, provider, name, email, productId, sessionToken } = req.body;

        // Construct callback URL dynamically
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const host = req.get('host');
        const callbackUrl = `${protocol}://${host}/webhooks/debito`;

        // Call payment service
        const result = await paymentService.processPayment(provider, phone, amount, callbackUrl);

        let productDetails = null;
        if (productId == '101') {
            productDetails = { name: 'Curso de Marketing Digital' };
        } else if (productId == '102') {
            productDetails = { name: 'Mentoria Exclusiva de Vendas' };
        } else if (productId == '103') {
            productDetails = { name: 'E-book: Segredos do Tráfego Pago' };
        } else if (productId) {
            productDetails = await Product.findByPk(productId);
        }

        if (result.success) {
            const saleId = `SALE-${Date.now()}`;
            // The result.data from paymentService is response.data from axios.
            // Based on common RatixPay/Debito response, it should have a reference or transaction_id.
            // If it's a STK Push initiation, it returns success:true when the request is accepted.
            const externalRef = result.data.reference || result.data.transaction_id || result.data.id;

            await Sale.create({
                id: saleId,
                product: productDetails ? productDetails.name : 'Venda Avulsa',
                customer: name || 'Cliente Anónimo',
                email: email || null,
                phone: phone || null,
                amount: parseFloat(amount),
                status: 'Pendente',
                vendedor_id: productDetails ? productDetails.vendedor_id : null,
                productId: productDetails ? productDetails.id : null,
                external_reference: externalRef
            });

            // Mark checkout session as used only on success
            if (sessionToken) {
                await CheckoutSession.update({ used: true }, { where: { token: sessionToken } });
            }

            return res.json({
                success: true,
                saleId: saleId,
                message: 'Pedido enviado! Confirme no seu telemóvel introduzindo o PIN.',
                redirect: `/thank-you/${saleId}`
            });
        } else {
            const saleId = `SALE-${Date.now()}`;
            await Sale.create({
                id: saleId,
                product: productDetails ? productDetails.name : 'Venda Avulsa',
                customer: name || 'Cliente Anónimo',
                email: email || null,
                phone: phone || null,
                amount: parseFloat(amount),
                status: 'Falhado',
                vendedor_id: productDetails ? productDetails.vendedor_id : null,
                productId: productDetails ? productDetails.id : null
            });

            return res.json({ success: false, error: (result.error || 'Erro desconhecido') });
        }
    } catch (err) {
        console.error(err);
        return res.json({ success: false, error: 'Ocorreu um erro interno no servidor.' });
    }
});

module.exports = router;
