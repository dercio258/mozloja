const axios = require('axios');
require('dotenv').config();

const MICROSERVICE_URL = process.env.PAYSUITE_MICROSERVICE_URL || 'http://localhost:8001';

const paysuiteService = {
    async initiatePayment(amount, phone, provider, reference) {
        try {
            const response = await axios.post(`${MICROSERVICE_URL}/api/pay`, {
                amount,
                phone,
                provider,
                reference
            });

            return response.data;
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
            console.error('PaySuite Service Error:', errorMsg);
            throw new Error(errorMsg);
        }
    },

    async checkStatus(gatewayId) {
        try {
            console.log(`[PaySuite API] Checking status for ${gatewayId}...`);
            
            if (!process.env.PAYSUITE_API_KEY) {
                console.error('[PaySuite API] CRITICAL: PAYSUITE_API_KEY is missing from .env');
            }

            // Poll using the internal ID (UUID) provided by PaySuite
            const response = await axios.get(`https://paysuite.tech/api/v1/payments/${gatewayId}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.PAYSUITE_API_KEY}`,
                    'Accept': 'application/json'
                },
                timeout: 10000 // 10 seconds timeout
            });

            const apiResponse = response.data;
            console.log(`[PaySuite API] Raw Response:`, JSON.stringify(apiResponse));
            
            // The documentation shows data.status, but the actual response has it in data.transaction.status
            const paymentStatus = apiResponse.data?.transaction?.status || apiResponse.data?.status || apiResponse.status;

            return {
                success: apiResponse.status === 'success',
                status: paymentStatus,
                data: apiResponse.data
            };
        } catch (error) {
            const errorData = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error(`[PaySuite API Error] Status: ${error.response?.status} | Data: ${errorData}`);
            return { success: false, error: errorData };
        }
    }
};

module.exports = paysuiteService;
