const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const CheckoutSession = require('../models/CheckoutSession');
const paysuiteService = require('../services/paysuiteService');
const debitoService = require('../services/debitoService');
const approvalService = require('../services/paymentApprovalService');
const utmTracking = require('../utils/utmTracking');

router.post('/pagar', async (req, res) => {
    try {
        const { amount, phone, provider, name, email, productId, sessionToken, orderBumps = [] } = req.body;
        
        // Validation
        if (!amount || !phone || !provider) {
            return res.status(400).json({ success: false, error: 'Campos obrigatórios em falta (amount, phone, provider)' });
        }

        let totalAmount = parseFloat(amount);
        if (isNaN(totalAmount)) {
            return res.status(400).json({ success: false, error: 'Valor de pagamento inválido' });
        }

        // Standardized sanitization (must match microservice v3.7)
        const reference = `Ped${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '');

        // 0. Capture Tracking Parameters
        const trackingParams = utmTracking.captureUTMParameters({
            reqBody: req.body,
            reqQuery: req.query,
            ip: req.ip || req.get('x-forwarded-for') || req.connection.remoteAddress
        });

        // 1. Create Main Sale record (Pendente)
        const saleId = `SALE-${Date.now()}`;
        const productDetails = productId ? await Product.findByPk(productId) : null;

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
            external_reference: reference,
            payment_service: productDetails ? productDetails.payment_service : 'paysuite',
            // Tracking
            utm_source: trackingParams.utm_source,
            utm_medium: trackingParams.utm_medium,
            utm_campaign: trackingParams.utm_campaign,
            utm_content: trackingParams.utm_content,
            utm_term: trackingParams.utm_term,
            src: trackingParams.src,
            sck: trackingParams.sck
        });

        // 2. Handle Order Bumps
        if (Array.isArray(orderBumps) && orderBumps.length > 0) {
            for (const bumpId of orderBumps) {
                const bumpProduct = await Product.findByPk(bumpId);
                if (bumpProduct) {
                    totalAmount += bumpProduct.price;
                    await Sale.create({
                        id: `SALE-BUMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        product: bumpProduct.name,
                        customer: name || 'Cliente Anónimo',
                        email: email || null,
                        phone: phone || null,
                        amount: bumpProduct.price,
                        status: 'Pendente',
                        vendedor_id: bumpProduct.vendedor_id,
                        productId: bumpProduct.id,
                        external_reference: reference,
                        // Tracking
                        utm_source: trackingParams.utm_source,
                        utm_medium: trackingParams.utm_medium,
                        utm_campaign: trackingParams.utm_campaign,
                        utm_content: trackingParams.utm_content,
                        utm_term: trackingParams.utm_term,
                        src: trackingParams.src,
                        sck: trackingParams.sck
                    });
                }
            }
        }

        // 3. Initiate Chosen Payment Interaction with total amount
        const paymentService = (productDetails && productDetails.payment_service === 'debito') ? debitoService : paysuiteService;
        console.log(`[Payment] Using service: ${productDetails?.payment_service || 'paysuite (default)'}`);
        
        const result = await paymentService.initiatePayment(totalAmount, phone, provider, reference);

        if (result.success || result.status === 'success') {
            const gatewayId = result.data?.id;

            // Update all sales with the internal gateway ID if available
            if (gatewayId) {
                await Sale.update({ gateway_id: gatewayId }, { where: { external_reference: reference } });
            }

            // 4. Optionally Polling for final confirmation
            const poll = async () => {
                // Skip polling for Debito service as requested by user
                if (paymentService === debitoService) {
                    console.log(`[Payment] Skipping polling for Debito service ref: ${reference}`);
                    return;
                }

                const pollId = gatewayId || reference;
            
                let attempts = 0;
                const maxAttempts = 3; // 2 minutes total at 40s
                
                const interval = setInterval(async () => {
                    attempts++;
                    console.log(`[Polling] Checking status for ${pollId} (Attempt ${attempts})`);
                    
                    const statusRes = await paymentService.checkStatus(pollId);
                    
                    // Unified status check (handling both root and data nested status)
                    const status = (statusRes.data?.transaction?.status || statusRes.data?.status || statusRes.status || '').toLowerCase();
                    console.log(`[Polling] Status for ${pollId}: ${status}`);
                    
                    if (statusRes.success && ['successful', 'completed', 'paid', 'approved'].includes(status)) {
                        console.log(`[Polling] SUCCESS! Approving sale for ref: ${reference}`);
                        clearInterval(interval);
                        await approvalService.approveSale(reference); // Still uses custom reference for DB lookup
                    }

                    if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        console.log(`[Polling] Timeout for ${pollId}`);
                    }
                }, 40000); // 40 seconds interval
            };

            poll();

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
            return res.status(400).json({ 
                success: false, 
                error: result.message || result.error || 'Falha ao iniciar pagamento',
                details: result
            });
        }

    } catch (err) {
        console.error('Pagamento Error:', err);
        res.status(500).json({ success: false, error: 'Erro interno ao processar pagamento' });
    }
});

module.exports = router;
