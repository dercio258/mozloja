const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Withdrawal = require('../models/Withdrawal');
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

        const normalizedStatus = txStatus ? txStatus.toLowerCase() : '';
        const isSuccess = ['successful', 'completed', 'paid', 'concluido', 'approved', 'success'].includes(normalizedStatus);
        const isFailure = ['failed', 'cancelled', 'expired', 'rejected', 'error'].includes(normalizedStatus);

        // Try to find a Sale first
        const sale = await Sale.findOne({
            where: { external_reference: txReference.toString() }
        });

        if (sale) {
            if (sale.status !== 'Pendente') {
                return res.json({ success: true, message: 'Sale status already updated' });
            }

            if (isSuccess) {
                await sale.update({ status: 'Concluído' });
                console.log(`✅ Sale ${sale.id} confirmed via webhook`);

                if (sale.productId) {
                    const product = await Product.findByPk(sale.productId);
                    if (product) {
                        try {
                            await utmifyService.enviarVenda(
                                sale,
                                product,
                                { name: sale.customer, email: sale.email, phone: sale.phone },
                                {}
                            );
                        } catch (utmErr) {
                            console.error('UTMify error:', utmErr.message);
                        }

                        if (product.webhook_url) {
                            try {
                                await axios.post(product.webhook_url, {
                                    event: 'order.paid',
                                    data: { id: sale.id, status: 'paid', amount: sale.amount, reference: txReference }
                                }, { timeout: 5000 });
                            } catch (webhookErr) {
                                console.error('Webhook error:', webhookErr.message);
                            }
                        }
                    }
                }
            } else if (isFailure) {
                await sale.update({ status: 'Falhado' });
                console.log(`❌ Sale ${sale.id} marked as failed via webhook`);
            }
            return res.json({ success: true });
        }

        // If no sale, try to find a Withdrawal
        const withdrawal = await Withdrawal.findOne({
            where: { ref: txReference.toString() }
        });

        if (withdrawal) {
            if (withdrawal.status !== 'Pendente') {
                return res.json({ success: true, message: 'Withdrawal status already updated' });
            }

            if (isSuccess) {
                await withdrawal.update({ status: 'Concluído' });
                console.log(`✅ Withdrawal ${withdrawal.id} confirmed via webhook`);
            } else if (isFailure) {
                await withdrawal.update({ status: 'Falhado' });
                console.log(`❌ Withdrawal ${withdrawal.id} marked as failed via webhook`);
            }
            return res.json({ success: true });
        }

        console.warn(`Reference not found in Sales or Withdrawals: ${txReference}`);
        return res.status(404).send('Reference not found');
    } catch (err) {
        console.error('Webhook Error:', err);
        return res.status(500).send('Internal Error');
    }
});

module.exports = router;
