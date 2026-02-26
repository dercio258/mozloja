const debitoService = require('./debitoService');

const paymentService = {
    // 1. Pagamento C2B (Cliente -> Negócio)
    async processPayment(provider, phone, amount, callbackUrl = null, customerData = {}) {
        console.log(`Initiating ${provider} payment for ${phone} amount ${amount}`);

        try {
            let result;
            const reference = `Ped-${Date.now()}`;

            if (provider === 'mpesa') {
                result = await debitoService.processMpesaPayment(amount, phone, reference);
            } else if (provider === 'emola') {
                result = await debitoService.processEmolaPayment(amount, phone, reference);
            } else if (provider === 'card') {
                result = await debitoService.processCardPayment(amount, customerData, reference);
            } else {
                return { success: false, error: 'Provedor de pagamento não suportado.' };
            }

            return result;
        } catch (error) {
            console.error('Payment Error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // 2. Pagamento B2C / Saque (Negócio -> Cliente)
    async processWithdrawal(provider, phone, amount) {
        console.log(`Initiating ${provider} withdrawal for ${phone} amount ${amount}`);
        try {
            let result;
            const reference = `WD-${Date.now()}`;

            if (provider === 'mpesa') {
                result = await debitoService.processB2CMpesa(amount, phone, reference);
            } else if (provider === 'emola') {
                result = await debitoService.processB2CEmola(amount, phone, reference);
            } else {
                return { success: false, error: 'Canal de saque não suportado.' };
            }

            return result;
        } catch (error) {
            console.error('Withdrawal Error:', error.message);
            return { success: false, error: error.message };
        }
    }
};

module.exports = paymentService;
