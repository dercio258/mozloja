const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const utmifyService = require('../services/utmifyService');
const axios = require('axios');

// Webhook endpoint for Debito.co.mz / RatixPay
// URL should be: https://yourdomain.com/webhooks/debito
router.post('/debito', async (req, res) => {
    try {
        console.log('Received Debito Webhook:', JSON.stringify(req.body));

        const { reference, status, data, external_id } = req.body;

        // Robust extraction from different possible JSON structures
        const txReference = reference || external_id || (data && (data.reference || data.id || data.external_id));
        const txStatus = status || (data && data.status);

        console.log(`Processing Webhook - Extracted Ref: ${txReference}, Status: ${txStatus}`);

        if (!txReference) {
            console.error('Webhook missing reference/external_id:', req.body);
            return res.status(400).send('Missing reference identifier');
        }

        // Find the sale by external_reference
        const sale = await Sale.findOne({
            where: { external_reference: txReference.toString() }
        });

        if (!sale) {
            console.warn(`Sale not found for reference: ${txReference}`);
            return res.status(404).send('Sale not found');
        }

        // Only update if current status is Pendente
        if (sale.status !== 'Pendente') {
            return res.json({ success: true, message: 'Status already updated' });
        }

        const normalizedStatus = txStatus ? txStatus.toLowerCase() : '';

        if (['successful', 'completed', 'paid', 'concluido'].includes(normalizedStatus)) {
            await sale.update({ status: 'Concluído' });
            console.log(`✅ Sale ${sale.id} confirmed via webhook`);

            // Trigger integrations after confirmation
            if (sale.productId) {
                const product = await Product.findByPk(sale.productId);
                if (product) {
                    // UTMify Notification
                    try {
                        await utmifyService.enviarVenda(
                            { id: sale.id, amount: sale.amount },
                            product,
                            { name: sale.customer, email: sale.email, phone: sale.phone },
                            {} // UTM params might be lost unless we store them in the Sale model
                        );
                    } catch (utmErr) {
                        console.error('UTMify Notification Error:', utmErr.message);
                    }

                    // Webhook Notification (Merchant's webhook)
                    if (product.webhook_url) {
                        try {
                            await axios.post(product.webhook_url, {
                                event: 'order.paid',
                                data: {
                                    id: sale.id,
                                    product: product.name,
                                    customer: sale.customer,
                                    email: sale.email,
                                    phone: sale.phone,
                                    amount: sale.amount,
                                    status: 'paid'
                                }
                            }, { timeout: 5000 });
                        } catch (webhookErr) {
                            console.error('❌ Merchant Webhook error:', webhookErr.message);
                        }
                    }
                }
            }
        } else if (txStatus === 'failed' || txStatus === 'cancelled') {
            await sale.update({ status: 'Falhado' });
            console.log(`❌ Sale ${sale.id} failed via webhook`);
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Webhook Processing Error:', err);
        return res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
