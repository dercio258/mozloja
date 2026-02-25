const axios = require('axios');

// Default API URL para o backend da RatixPay (conf. openapi.yaml)
const API_BASE_URL = process.env.API_BASE_URL || 'https://my.debito.co.mz';

const paymentService = {
    // Retorna a Wallet ID correspondente ao provedor
    getWalletId(provider) {
        if (provider === 'emola') {
            return process.env.EMOLA_API_KEY;
        } else if (provider === 'mpesa') {
            return process.env.MPESA_API_KEY;
        }
        // Fallback apenas de segurança
        return process.env.WALLET_ID || 122767;
    },

    // Retorna os headers de autenticação
    getAuthHeaders() {
        let token = process.env.debito_token;
        if (!token) {
            console.warn('⚠️ debito_token não encontrado no .env. As transações falharão.');
        } else if (token.startsWith('Bearer ')) {
            token = token.substring(7); // Remove o 'Bearer ' que já vem do .env
        }
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    },

    // 1. Pagamento C2B (Cliente -> Negócio)
    async processPayment(provider, phone, amount, callbackUrl = null) {
        const walletId = this.getWalletId(provider);
        console.log(`Initiating ${provider} C2B payment for ${phone} amount ${amount} on wallet ${walletId}`);

        try {
            const url = `${API_BASE_URL}/api/v1/wallets/${walletId}/c2b/${provider}`;
            const payload = {
                msisdn: phone,
                amount: parseFloat(amount),
                reference_description: `Pagamento via ${provider}`,
                internal_notes: `Venda iniciada pelo checkout. Lite Project.`,
                callback_url: callbackUrl
            };

            const response = await axios.post(url, payload, { headers: this.getAuthHeaders() });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('C2B Payment Error:', error.response ? JSON.stringify(error.response.data) : error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    },

    // 2. Pagamento B2C / Saque (Negócio -> Cliente)
    async processWithdrawal(provider, phone, amount) {
        const walletId = this.getWalletId(provider);
        console.log(`Initiating ${provider} B2C withdrawal for ${phone} amount ${amount} on wallet ${walletId}`);

        try {
            const url = `${API_BASE_URL}/api/v1/wallets/${walletId}/b2c/${provider}`;
            const payload = {
                msisdn: phone,
                amount: parseFloat(amount),
                reference_description: `Saque ${provider}`,
                internal_notes: `Solicitação de saque. Lite Project.`
            };

            const response = await axios.post(url, payload, { headers: this.getAuthHeaders() });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('B2C Withdrawal Error:', error.response ? JSON.stringify(error.response.data) : error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    },

    // 3. Consultar Status da Transação
    async checkTransactionStatus(debitoReference) {
        try {
            const url = `${API_BASE_URL}/api/v1/transactions/${debitoReference}/status`;
            const response = await axios.get(url, { headers: this.getAuthHeaders() });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Check Status Error:', error.response ? JSON.stringify(error.response.data) : error.message);
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
};

module.exports = paymentService;
