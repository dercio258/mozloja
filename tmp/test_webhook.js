const axios = require('axios');

const WEBHOOK_URL = 'http://localhost:3000/webhooks/debito';

const testSaleWebhook = async () => {
    console.log('Testing Sale Webhook...');
    const payload = {
        reference: 'Ped-123456789', // Replace with a real reference from your DB for a full test
        status: 'successful',
        data: { amount: 100 }
    };
    try {
        const res = await axios.post(WEBHOOK_URL, payload);
        console.log('Sale Webhook Response:', res.status, res.data);
    } catch (err) {
        console.error('Sale Webhook Error:', err.message);
    }
};

const testWithdrawalWebhook = async () => {
    console.log('Testing Withdrawal Webhook...');
    const payload = {
        external_id: 'WD-123456789', // Replace with a real reference from your DB
        status: 'completed'
    };
    try {
        const res = await axios.post(WEBHOOK_URL, payload);
        console.log('Withdrawal Webhook Response:', res.status, res.data);
    } catch (err) {
        console.error('Withdrawal Webhook Error:', err.message);
    }
};

// testSaleWebhook();
// testWithdrawalWebhook();
