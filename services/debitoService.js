const axios = require('axios');
require('dotenv').config();

class DebitoService {
    constructor() {
        const isLocal = process.env.NODE_ENV === 'development' || process.env.AMBIENTE === 'local';
        let selectedUrl = isLocal ? 'https://api.debito.co.mz' : 'https://api.debito.co.mz'; // Defaulting to real URL as per user request context

        if (process.env.DEBITO_API_URL) {
            selectedUrl = process.env.DEBITO_API_URL;
        }

        this.baseUrl = selectedUrl;
        this.token = process.env.TOKEN_DEBITO;

        this.walletIdMpesa = process.env.DEBITO_WALLET_ID_MPESA;
        this.walletIdEmola = process.env.DEBITO_WALLET_ID_EMOLA;
        this.defaultWalletId = process.env.DEBITO_WALLET_ID;

        this.timeoutMs = 60000;

        console.log(`🔌 [Debito] Service initialized. Base URL: ${this.baseUrl}`);
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    sanitizeMsisdn(msisdn) {
        if (!msisdn) return '';
        let clean = msisdn.toString().replace(/\D/g, '');
        if (clean.startsWith('258') && clean.length === 12) return clean;
        if (clean.length === 9) return `258${clean}`;
        return clean;
    }

    async initiatePayment(amount, msisdn, provider, reference) {
        try {
            const sanitizedMsisdn = this.sanitizeMsisdn(msisdn);
            const walletId = (provider === 'emola') ? this.walletIdEmola : (this.walletIdMpesa || this.defaultWalletId);
            
            if (!walletId) throw new Error(`Wallet ID for ${provider} not configured`);

            const payload = {
                msisdn: sanitizedMsisdn,
                amount: parseFloat(amount),
                reference_description: reference,
                internal_notes: `Venda ${reference} via ${provider}`
            };

            const endpoint = provider === 'emola' ? 'emola' : 'mpesa';
            const url = `${this.baseUrl}/api/v1/wallets/${walletId}/c2b/${endpoint}`;

            console.log(`🚀 [Debito] Initiating ${provider.toUpperCase()} Payment:`, { url, payload });

            const response = await axios.post(url, payload, {
                headers: this.getHeaders(),
                timeout: this.timeoutMs
            });

            return {
                success: true,
                status: 'success',
                data: response.data,
                transaction_id: response.data.transaction_id || response.data.id || null,
                message: response.data.message || 'Pagamento iniciado'
            };

        } catch (error) {
            console.error(`❌ [Debito] ${provider.toUpperCase()} Payment Failed:`, error.response?.data || error.message);
            return {
                success: false,
                status: 'error',
                message: error.response?.data?.message || error.message || 'Falha ao iniciar pagamento',
                error: error.response?.data
            };
        }
    }

    async checkStatus(transactionId) {
        // Implement status check if the Debito API supports it, otherwise return pending
        return { success: true, status: 'pending' };
    }
}

module.exports = new DebitoService();
