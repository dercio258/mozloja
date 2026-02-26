const axios = require('axios');

class DebitoService {
    constructor() {
        const isLocal = process.env.NODE_ENV === 'development' ||
            process.env.AMBIENTE === 'local' ||
            process.env.developmentenviroment === 'local';

        let selectedUrl = isLocal ? 'http://localhost:8000' : 'https://api.debito.co.mz';

        if (process.env.DEBITO_API_URL) {
            selectedUrl = process.env.DEBITO_API_URL;
        } else if (process.env.API_BASE_URL) {
            selectedUrl = process.env.API_BASE_URL;
        }

        this.baseUrl = selectedUrl;

        // Suporte a múltiplas chaves de ambiente
        let token = process.env.TOKEN_DEBITO || process.env.debito_token;
        if (token && token.startsWith('Bearer ')) {
            token = token.substring(7);
        }
        this.token = token;

        this.walletIdBank = process.env.DEBITO_WALLET_ID_BANK;
        this.walletIdMpesa = process.env.DEBITO_WALLET_ID_MPESA || process.env.MPESA_API_KEY;
        this.walletIdEmola = process.env.DEBITO_WALLET_ID_EMOLA || process.env.EMOLA_API_KEY;
        this.defaultWalletId = process.env.DEBITO_WALLET_ID || process.env.WALLET_ID;

        this.timeoutMs = 60000;
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    normalizePhone(phone) {
        if (!phone) return null;
        let num = phone.toString().replace(/\D/g, '');
        if (num.length === 9) return '258' + num;
        return num;
    }

    normalizeMSISDN(msisdn) {
        if (!msisdn) return null;
        let num = msisdn.toString().replace(/\D/g, '');
        // Se começar com 258 e tiver mais de 9 dígitos, remove o prefixo
        if (num.length > 9 && num.startsWith('258')) {
            num = num.substring(3);
        }
        // Garante que retorna apenas os últimos 9 dígitos (padrão moçambicano local)
        if (num.length > 9) {
            num = num.slice(-9);
        }
        return num;
    }

    splitName(fullName) {
        const name = (fullName || 'Customer').trim();
        const parts = name.split(' ');
        const firstName = parts[0];
        const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;
        return { firstName, lastName };
    }

    // --- C2B (PAGAMENTOS) ---

    async processCardPayment(amount, customerData, reference) {
        try {
            const walletId = this.walletIdBank || this.defaultWalletId;
            if (!walletId) throw new Error('Wallet ID para Banco/Cartão não configurado');

            const { firstName, lastName } = this.splitName(customerData.name || customerData.nome || customerData.first_name);

            const payload = {
                amount: parseFloat(amount),
                reference_description: reference || `Ped-${Date.now()}`,
                first_name: firstName,
                last_name: lastName,
                email: customerData.email || 'customer@example.com',
                phone: this.normalizePhone(customerData.phone) || '258800000000',
                callback_url: process.env.DEBITO_CALLBACK_URL || process.env.PRODUCTION_URL + '/webhooks/debito'
            };

            const response = await axios.post(`${this.baseUrl}/api/v1/wallets/${walletId}/card-payment`, payload, {
                headers: this.getHeaders(),
                timeout: this.timeoutMs
            });

            return {
                success: true,
                data: response.data,
                transaction_id: response.data.transaction_id || response.data.id || null
            };
        } catch (error) {
            console.error('❌ [Debito] CARD Payment Failed:', error.response?.data || error.message);
            return { success: false, message: error.response?.data?.message || error.message };
        }
    }

    async processMpesaPayment(amount, msisdn, reference) {
        return this.processC2B('mpesa', amount, msisdn, reference);
    }

    async processEmolaPayment(amount, msisdn, reference) {
        return this.processC2B('emola', amount, msisdn, reference);
    }

    async processC2B(channel, amount, msisdn, reference) {
        try {
            const walletId = channel === 'mpesa' ? this.walletIdMpesa : this.walletIdEmola;
            const finalWallet = walletId || this.defaultWalletId;

            if (!finalWallet) throw new Error(`Wallet ID para ${channel} não configurado`);

            const payload = {
                msisdn: this.normalizeMSISDN(msisdn),
                amount: parseFloat(amount),
                reference_description: reference || `Ped-${Date.now()}`,
                internal_notes: `Pagamento ${channel.toUpperCase()} Lite Project`
            };

            const response = await axios.post(`${this.baseUrl}/api/v1/wallets/${finalWallet}/c2b/${channel}`, payload, {
                headers: this.getHeaders(),
                timeout: this.timeoutMs
            });

            return {
                success: true,
                data: response.data,
                transaction_id: response.data.transaction_id || response.data.id || null
            };
        } catch (error) {
            console.error(`❌ [Debito] ${channel.toUpperCase()} C2B Failed:`, error.response?.data || error.message);
            return { success: false, message: error.response?.data?.message || error.message };
        }
    }

    // --- B2C (SAQUES) ---

    async processB2CMpesa(amount, msisdn, reference) {
        return this.processB2C('mpesa', amount, msisdn, reference);
    }

    async processB2CEmola(amount, msisdn, reference) {
        return this.processB2C('emola', amount, msisdn, reference);
    }

    async processB2C(channel, amount, msisdn, reference) {
        try {
            const walletId = channel === 'mpesa' ? this.walletIdMpesa : this.walletIdEmola;
            const finalWallet = walletId || this.defaultWalletId;

            const payload = {
                msisdn: this.normalizeMSISDN(msisdn),
                amount: parseFloat(amount),
                reference_description: reference || `Saque-${Date.now()}`,
                internal_notes: `Saque ${channel.toUpperCase()} Lite Project`
            };

            const response = await axios.post(`${this.baseUrl}/api/v1/wallets/${finalWallet}/b2c/${channel}`, payload, {
                headers: this.getHeaders(),
                timeout: this.timeoutMs
            });

            return {
                success: true,
                data: response.data,
                transaction_id: response.data.transaction_id || response.data.id || null
            };
        } catch (error) {
            console.error(`❌ [Debito] ${channel.toUpperCase()} B2C Failed:`, error.response?.data || error.message);
            return { success: false, message: error.response?.data?.message || error.message };
        }
    }

    // --- STATUS ---

    async checkTransactionStatus(reference) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v1/transactions/${reference}/status`, {
                headers: this.getHeaders(),
                timeout: 10000
            });

            return {
                success: true,
                status: response.data.status,
                data: response.data
            };
        } catch (error) {
            console.error('❌ [Debito] STATUS Check Failed:', error.response?.data || error.message);
            return { success: false, message: error.response?.data?.message || error.message };
        }
    }
}

module.exports = new DebitoService();
