const axios = require('axios');

async function testWebhook() {
    const payload = {
        transaction_id: 'TEST-DEBITO-' + Date.now(),
        status: 'successful',
        amount: 10.00,
        msisdn: '841234567'
    };

    console.log('Sending mock webhook payload:', payload);

    try {
        const response = await axios.post('http://localhost:3000/webhooks/debito', payload);
        console.log('Response:', response.status, response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testWebhook();
