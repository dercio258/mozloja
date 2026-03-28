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
        
        // Se já tiver 12 dígitos começando com 258, está correto
        if (clean.startsWith('258') && clean.length === 12) {
            return clean;
        }
        
        // Se tiver 9 dígitos e começar com 8 (padrão local), enviar apenas os 9 dígitos
        // Algumas APIs da Debito preferem o formato local de 9 dígitos para C2B
        if (clean.length === 9 && ['82', '83', '84', '85', '86', '87'].includes(clean.substring(0, 2))) {
            return clean;
        }

        // Caso contrário, tenta garantir o 258 se tiver 9 dígitos mas não começar com 8
        if (clean.length === 9) {
            return `258${clean}`;
        }
        
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

    async checkStatus(reference) {
        try {
            // URL format: /api/v1/transactions/{reference}/status
            const url = `${this.baseUrl}/api/v1/transactions/${reference}/status`;
            
            console.log(`🔍 [Debito] Checking status for ref: ${reference}`);
            
            const response = await axios.get(url, {
                headers: this.getHeaders(),
                timeout: 10000
            });

            // Standardize response to match what pagamento.js expects
            const data = response.data;
            const apiStatus = (data.status || data.data?.status || '').toLowerCase();

            return {
                success: true,
                status: apiStatus,
                data: data
            };
        } catch (error) {
            console.error(`❌ [Debito] Status check failed for ${reference}:`, error.response?.data || error.message);
            return {
                success: false,
                status: 'error',
                message: error.response?.data?.message || error.message
            };
        }
    }
}

module.exports = new DebitoService();
