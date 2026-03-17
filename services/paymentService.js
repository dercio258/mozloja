const paysuiteService = require('./paysuiteService');

const paymentService = {
    // 1. Pagamento C2B (Cliente -> Negócio)
    async processPayment(provider, phone, amount, callbackUrl = null, customerData = {}) {
        console.log(`Initiating ${provider} payment for ${phone} amount ${amount}`);

        try {
            let result;
            const reference = `Ped-${Date.now()}`;

            if (['mpesa', 'emola', 'paysuite'].includes(provider)) {
                result = await paysuiteService.initiatePayment(amount, phone, provider, reference);
            } else {
                return { success: false, error: 'Provedor de pagamento não suportado.' };
            }

            return {
                success: result.success,
                transaction_id: reference,
                status: result.status || 'pending',
                message: result.message
            };
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
            return { success: false, error: 'Serviço de saque em manutenção.' };
        } catch (error) {
            console.error('Withdrawal Error:', error.message);
            return { success: false, error: error.message };
        }
    }
};

module.exports = paymentService;
