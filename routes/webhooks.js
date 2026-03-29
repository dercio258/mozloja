const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Withdrawal = require('../models/Withdrawal');
const utmifyService = require('../services/utmifyService');
const { Op } = require('sequelize');
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
        const isSuccess = ['successful', 'completed', 'paid', 'approved'].includes(normalizedStatus);
        const isFailure = ['failed', 'cancelled', 'expired', 'rejected', 'error'].includes(normalizedStatus);

        // Try to find a Sale first using robust lookup
        const sale = await Sale.findOne({
            where: {
                [Op.or]: [
                    { external_reference: txReference.toString() },
                    { gateway_id: txReference.toString() },
                    { id: txReference.toString() }
                ]
            }
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
                                    data: { 
                                        id: sale.id, 
                                        status: 'paid', 
                                        amount: sale.amount, 
                                        customer_phone: sale.phone,
                                        customer_email: sale.email,
                                        transaction_id: txReference,
                                        product_name: product.name
                                    }
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
        console.log('Received Debito Webhook Payload:', JSON.stringify(req.body));

        // Extract multiple possible reference fields from payload
        const { 
            reference, 
            status, 
            transaction_id, 
            external_id, 
            id,
            payment_id,
            tx_id,
            customer_contact,
            msisdn,
            phone: payloadPhone
        } = req.body;

        const txReference = reference || external_id || transaction_id || id || payment_id || tx_id;
        
        console.log(`🔍 [Debito Webhook] Searching for sale with ref: ${txReference}, transaction_id: ${transaction_id || id}`);

        if (!txReference && !customer_contact && !msisdn && !payloadPhone) {
            return res.status(400).send('Missing reference identifier');
        }

        const normalizedStatus = status ? status.toLowerCase() : '';
        const isSuccess = ['successful', 'completed', 'paid', 'approved'].includes(normalizedStatus);
        const isFailure = ['failed', 'cancelled', 'expired', 'rejected', 'error'].includes(normalizedStatus);

        // Try Sale - robust lookup
        const sale = await Sale.findOne({
            where: {
                [Op.or]: [
                    { external_reference: txReference ? txReference.toString() : '___NONE___' },
                    { gateway_id: transaction_id ? transaction_id.toString() : '___NONE___' },
                    { gateway_id: id ? id.toString() : '___NONE___' },
                    { gateway_id: reference ? reference.toString() : '___NONE___' },
                    { id: txReference ? txReference.toString() : '___NONE___' }
                ]
            } 
        });

        if (!sale) {
            console.log(`⚠️ Debito Webhook: Sale not found for reference ${txReference}. Trying fallback...`);
            // Fallback: search by phone and amount if recent (last 60 mins)
            const contact = customer_contact || msisdn || payloadPhone;
            if (contact && req.body.amount) {
                const cleanPhone = contact.toString().replace(/\D/g, '').slice(-9);
                const fallbackSale = await Sale.findOne({
                    where: {
                        phone: { [Op.like]: `%${cleanPhone}` },
                        amount: parseFloat(req.body.amount),
                        status: 'Pendente',
                        createdAt: { [Op.gt]: new Date(Date.now() - 60 * 60 * 1000) }
                    },
                    order: [['createdAt', 'DESC']]
                });
                if (fallbackSale) {
                    console.log(`✅ Debito Webhook: Found sale ${fallbackSale.id} via fallback (phone ${cleanPhone} / amount ${req.body.amount})`);
                    await processConfirmedSale(fallbackSale, txReference || id || 'FALLBACK');
                    return res.json({ success: true, message: 'Sale updated via fallback' });
                }
            }
            return res.status(404).json({ success: false, message: 'Reference not found' });
        }

        async function processConfirmedSale(s, ref) {
            if (s.status === 'Pendente') {
                if (isSuccess) {
                    await s.update({ status: 'Concluído', gateway_id: transaction_id || ref });
                    console.log(`✅ Sale ${s.id} confirmed via Debito webhook`);
                } else if (isFailure) {
                    await s.update({ status: 'Falhado', gateway_id: transaction_id || ref });
                    console.log(`❌ Sale ${s.id} marked as failed via Debito webhook`);
                } else {
                    console.log(`ℹ️ Debito Webhook: Status is ${normalizedStatus}, no action taken.`);
                }
                
                // Trigger tracking and external webhooks if productId is present
                if (s.productId) {
                    const product = await Product.findByPk(s.productId);
                    if (product) {
                        // Notify via Socket.io for real-time frontend update
                        const socketService = require('../services/socketService');
                        const redirectUrl = product.content_link || '/obrigado?venda=' + s.id;
                        socketService.notifyPaymentSuccess(s.id.toString(), redirectUrl);

                        try {
                            const utmifyService = require('../services/utmifyService');
                            await utmifyService.enviarVenda(s, product, { name: s.customer, email: s.email, phone: s.phone }, {});
                        } catch (e) { console.error('UTMify error:', e.message); }
                        
                        if (product.webhook_url) {
                            try {
                                const axios = require('axios');
                                await axios.post(product.webhook_url, {
                                    event: 'order.paid',
                                    data: { 
                                        id: s.id, 
                                        status: 'paid', 
                                        amount: s.amount, 
                                        customer_phone: s.phone,
                                        customer_email: s.email,
                                        transaction_id: ref,
                                        product_name: product.name
                                    }
                                }, { timeout: 5000 });
                            } catch (e) { console.error('Product Webhook error:', e.message); }
                        }
                    }
                }
            }
        }

        if (sale) {
            await processConfirmedSale(sale, txReference);
            return res.json({ success: true, message: 'Sale updated' });
        }

        // Try Withdrawal by ref or transaction ID
        const withdrawal = await Withdrawal.findOne({
            where: {
                [Op.or]: [
                    { ref: txReference.toString() },
                    { ref: transaction_id ? transaction_id.toString() : null }
                ]
            } 
        });
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
