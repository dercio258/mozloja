const express = require('express');
const axios = require('axios');
const automationService = require('./src/services/automationService');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.MICROSERVICE_PORT || 8001;
const PAYSUITE_API_KEY = process.env.PAYSUITE_API_KEY;
const PAYSUITE_API_URL = process.env.PAYSUITE_API_URL || 'https://paysuite.tech/api/v1/payments'; // Default URL if not set

app.post('/api/pay', async (req, res) => {
    try {
        const { amount, phone, provider, reference } = req.body;
        
        // Sanitization: Reference must only contain letters and numbers as per v3.7
        const sanitizedReference = (reference || `REF${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '');

        console.log(`[VINTAGE v3.7] Processing payment for ${sanitizedReference}`);

        const response = await axios.post(PAYSUITE_API_URL, {
            amount: amount,
            reference: sanitizedReference,
            description: `Venda ${sanitizedReference}`,
            method: provider,
            callback_url: process.env.PAYSUITE_WEBHOOK_URL,
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.PAYSUITE_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (response.data.status === 'success' && response.data.data.checkout_url) {
            const checkoutUrl = response.data.data.checkout_url;
            console.log(`[VINTAGE v3.7] Checkout URL: ${checkoutUrl}. Triggering automation...`);
            
            // Interaction Layer
            const interaction = await automationService.triggerUSSDPush(checkoutUrl, phone, provider);
            
            return res.json({
                ...response.data,
                interaction_status: interaction.success ? 'submitted' : 'failed',
                server_message: interaction.error || 'Automation triggered'
            });
        }


    } catch (error) {
        console.error('[Microservice] Error initiating payment:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.message || error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`PaySuite Automation Microservice running on port ${PORT}`);
});
