const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Withdrawal = require('../models/Withdrawal');
const utmifyService = require('../services/utmifyService');
const axios = require('axios');

// Webhook endpoint for PaySuite
// URL should be: https://yourdomain.com/webhooks/paysuite
router.post('/paysuite', async (req, res) => {
    try {
        console.log('Received PaySuite Webhook:', JSON.stringify(req.body));

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

// Webhook endpoint for Debito
router.post('/debito', async (req, res) => {
    try {
        console.log('Received Debito Webhook:', JSON.stringify(req.body));

        // Use reference or transaction_id from the payload
        const { reference, status, transaction_id, external_id } = req.body;
        const txReference = reference || external_id || transaction_id;
        
        if (!txReference) {
            return res.status(400).send('Missing reference identifier');
        }

        const normalizedStatus = status ? status.toLowerCase() : '';
        const isSuccess = ['successful', 'completed', 'paid', 'concluido', 'approved', 'success'].includes(normalizedStatus);
        const isFailure = ['failed', 'cancelled', 'expired', 'rejected', 'error'].includes(normalizedStatus);

        // Try Sale
        const sale = await Sale.findOne({ where: { external_reference: txReference.toString() } });
        if (sale) {
            if (sale.status === 'Pendente') {
                if (isSuccess) {
                    await sale.update({ status: 'Concluído' });
                    console.log(`✅ Sale ${sale.id} confirmed via Debito webhook`);
                    
                    // Trigger tracking and external webhooks if productId is present
                    if (sale.productId) {
                        const product = await Product.findByPk(sale.productId);
                        if (product) {
                            // Notify via Socket.io for real-time frontend update
                            const socketService = require('../services/socketService');
                            const redirectUrl = product.content_link || '/obrigado?venda=' + sale.id;
                            socketService.notifyPaymentSuccess(sale.id.toString(), redirectUrl);

                            try {
                                await utmifyService.enviarVenda(sale, product, { name: sale.customer, email: sale.email, phone: sale.phone }, {});
                            } catch (e) { console.error('UTMify error:', e.message); }
                            
                            if (product.webhook_url) {
                                try {
                                    await axios.post(product.webhook_url, {
                                        event: 'order.paid',
                                        data: { id: sale.id, status: 'paid', amount: sale.amount, reference: txReference }
                                    }, { timeout: 5000 });
                                } catch (e) { console.error('Product Webhook error:', e.message); }
                            }
                        }
                    }
                } else if (isFailure) {
                    await sale.update({ status: 'Falhado' });
                }
            }
            return res.json({ success: true });
        }

        // Try Withdrawal
        const withdrawal = await Withdrawal.findOne({ where: { ref: txReference.toString() } });
        if (withdrawal) {
            if (withdrawal.status === 'Pendente') {
                if (isSuccess) await withdrawal.update({ status: 'Concluído' });
                else if (isFailure) await withdrawal.update({ status: 'Falhado' });
            }
            return res.json({ success: true });
        }

        return res.status(404).send('Reference not found');
    } catch (err) {
        console.error('Debito Webhook Error:', err);
        res.status(500).send('Internal Error');
    }
});

module.exports = router;
