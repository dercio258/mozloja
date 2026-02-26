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

        const txReference = reference || external_id || (data && (data.reference || data.id || data.external_id));
        const txStatus = status || (data && data.status);

        if (!txReference) {
            return res.status(400).send('Missing reference identifier');
        }

        const sale = await Sale.findOne({
            where: { external_reference: txReference.toString() }
        });

        if (!sale) {
            console.warn(`Sale not found for reference: ${txReference}`);
            return res.status(404).send('Sale not found');
        }

        if (sale.status !== 'Pendente') {
            return res.json({ success: true, message: 'Status already updated' });
        }

        const normalizedStatus = txStatus ? txStatus.toLowerCase() : '';

        // Status alignment with main project
        if (['successful', 'completed', 'paid', 'concluido', 'approved'].includes(normalizedStatus)) {
            await sale.update({ status: 'Concluído' });
            console.log(`✅ Sale ${sale.id} confirmed`);

            if (sale.productId) {
                const product = await Product.findByPk(sale.productId);
                if (product) {
                    // Trigger UTMify
                    try {
                        await utmifyService.enviarVenda(
                            sale,
                            product,
                            { name: sale.customer, email: sale.email, phone: sale.phone },
                            {} // UTM params from sale.tracking_data if implemented
                        );
                    } catch (utmErr) {
                        console.error('UTMify error:', utmErr.message);
                    }

                    // Merchant Webhook
                    if (product.webhook_url) {
                        try {
                            await axios.post(product.webhook_url, {
                                event: 'order.paid',
                                data: { id: sale.id, status: 'paid', amount: sale.amount }
                            }, { timeout: 5000 });
                        } catch (webhookErr) {
                            console.error('Webhook error:', webhookErr.message);
                        }
                    }
                }
            }
        } else if (['failed', 'cancelled', 'expired'].includes(normalizedStatus)) {
            await sale.update({ status: 'Falhado' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Webhook Error:', err);
        return res.status(500).send('Internal Error');
    }
});

module.exports = router;
