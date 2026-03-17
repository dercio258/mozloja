const utmifyService = require('./utmifyService');
const socketService = require('./socketService');
const Sale = require('../models/Sale');
const Product = require('../models/Product');

// Advanced Financial Logic Services
const SaldoVendedorService = { 
    credit: async (vendorId, amount) => {
        // This would interact with a VendedorBalance model
        console.log(`[Balance] Crediting ${amount.toFixed(2)} MT to vendor ${vendorId}`);
        // await VendedorBalance.increment('balance', { by: amount, where: { vendorId } });
    } 
};

const AffiliateService = { 
    calculateAndCredit: async (sale) => {
        // Logic to detect if sale has an affiliate (from UTM or a specific field)
        const affiliateCommission = sale.amount * 0.05; // Example 5%
        console.log(`[Affiliate] Crediting ${affiliateCommission.toFixed(2)} MT commission for sale ${sale.id}`);
        return affiliateCommission;
    } 
};

const WhatsAppService = { sendReceipt: async (sale) => console.log(`[WhatsApp] Sending receipt to ${sale.phone}`) };
const EmailService = { sendNotification: async (sale) => console.log(`[Email] Sending notification to ${sale.email}`) };

const paymentApprovalService = {
    async approveSale(saleIdOrRef, externalRef = null) {
        try {
            console.log(`[Approval] Searching for sales with ID or Ref: ${saleIdOrRef}`);
            const sales = await Sale.findAll({
                where: {
                    [require('sequelize').Op.or]: [
                        { id: saleIdOrRef },
                        { external_reference: externalRef || saleIdOrRef }
                    ]
                }
            });

            console.log(`[Approval] Found ${sales.length} sales.`);
            if (sales.length === 0) throw new Error('No sales found to approve');
            
            for (const sale of sales) {
                if (sale.status === 'Concluído') continue;

                // 1. Calculate Payouts & Commissions
                const vendorPayout = sale.amount * 0.90;
                const affiliateComm = await AffiliateService.calculateAndCredit(sale);

                // 2. Update status and accounting
                await sale.update({
                    status: 'Concluído',
                    external_reference: externalRef || sale.external_reference,
                    payout_amount: vendorPayout,
                    affiliate_commission: affiliateComm
                });

                console.log(`✅ Sale ${sale.id} approved (Payout: ${vendorPayout.toFixed(2)} MT)`);

                // 3. Financial Credit
                const product = await Product.findByPk(sale.productId);
                if (product && product.vendedor_id) {
                    await SaldoVendedorService.credit(product.vendedor_id, vendorPayout);
                }

                // 4. Notifications
                if (sale.phone) WhatsAppService.sendReceipt(sale).catch(e => console.error('WA Error:', e));
                if (sale.email) EmailService.sendNotification(sale).catch(e => console.error('Email Error:', e));

                // 5. UTMify Tracking
                if (product) {
                    utmifyService.enviarVenda(
                        sale,
                        product,
                        { name: sale.customer, email: sale.email, phone: sale.phone },
                        {
                            utm_source: sale.utm_source,
                            utm_medium: sale.utm_medium,
                            utm_campaign: sale.utm_campaign,
                            utm_content: sale.utm_content,
                            utm_term: sale.utm_term,
                            src: sale.src,
                            sck: sale.sck
                        }
                    ).catch(e => console.error('UTMify Error:', e));
                }

                // 6. Real-time Frontend Notification
                socketService.notifyPaymentSuccess(sale.id, `/thank-you/${sale.id}`);
            }

            return { success: true };
        } catch (error) {
            console.error('Approval Service Error:', error.message);
            throw error;
        }
    }
};

module.exports = paymentApprovalService;
