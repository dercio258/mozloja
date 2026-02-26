const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const Sale = require('../models/Sale');
const Withdrawal = require('../models/Withdrawal');

// Calculate balance helper
const getBalanceAndHistory = async () => {
    const sales = await Sale.sum('amount', { where: { status: 'Concluído' } }) || 0;
    const withdrawalsSum = await Withdrawal.sum('amount', { where: { status: 'Concluído' } }) || 0;
    const balance = sales - withdrawalsSum;
    const withdrawals = await Withdrawal.findAll({ order: [['createdAt', 'DESC']] });
    return { balance, withdrawals };
};

// Renderiza a página de Saque
router.get('/', async (req, res) => {
    try {
        const { balance, withdrawals } = await getBalanceAndHistory();
        res.render('saque', {
            balance,
            withdrawals,
            error: null,
            success: null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading withdrawals page');
    }
});

// Processa o pedido de Saque
router.post('/process', async (req, res) => {
    try {
        const { amount, phone, provider } = req.body;
        const withdrawAmount = parseFloat(amount);

        const { balance, withdrawals } = await getBalanceAndHistory();

        // Validações locais
        if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount < 1) {
            return res.render('saque', {
                balance,
                withdrawals,
                error: 'O valor do saque deve ser maior ou igual a 1 MT.',
                success: null
            });
        }

        if (withdrawAmount > balance) {
            return res.render('saque', {
                balance,
                withdrawals,
                error: 'Saldo insuficiente para efetuar este saque.',
                success: null
            });
        }

        const result = await paymentService.processWithdrawal(provider, phone, withdrawAmount);

        if (result.success) {
            // Usar o ID retornado pela API para rastreamento robusto
            const ref = result.transaction_id || result.data?.id || (result.data && result.data.debito_reference) || 'Sem Ref';

            await Withdrawal.create({
                id: `WD-${Date.now()}`,
                method: provider,
                amount: withdrawAmount,
                status: 'Concluído', // Saque B2C geralmente é imediato na API de Debito
                ref: ref.toString()
            });

            const updated = await getBalanceAndHistory();

            res.render('saque', {
                balance: updated.balance,
                withdrawals: updated.withdrawals,
                success: `Saque de ${withdrawAmount} MT via ${provider} realizado com sucesso! Ref: ${ref}`,
                error: null
            });
        } else {
            const errorMsg = result.message || result.error || 'Falha desconhecida na API';

            await Withdrawal.create({
                id: `WD-${Date.now()}`,
                method: provider,
                amount: withdrawAmount,
                status: 'Falhado',
                ref: 'Erro: ' + errorMsg.substring(0, 50)
            });

            const updated = await getBalanceAndHistory();

            res.render('saque', {
                balance: updated.balance,
                withdrawals: updated.withdrawals,
                error: `Falha no saque: ${errorMsg}`,
                success: null
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error processing withdrawal');
    }
});

module.exports = router;
