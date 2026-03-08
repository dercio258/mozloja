const axios = require('axios');

/**
 * Serviço de Integração com UTMify para o Projeto Lite
 * Envia vendas automaticamente para a API oficial da UTMify
 */
class UTMifyService {
    constructor() {
        this.apiUrl = 'https://api.utmify.com.br/api-credentials/orders';
        this.timeout = 10000;
    }

    async enviarVenda(venda, produto, cliente, trackingParams = {}, options = {}) {
        try {
            // No projeto Lite, usamos 'utmify_id' ou 'utmfy_api_key'
            const utmifyToken = produto.utmify_id || produto.utmfy_api_key;

            if (!utmifyToken) {
                console.log('⚠️ UTMIFY: Produto não possui token configurado. Pulando envio.');
                return { success: false, skipped: true };
            }

            const body = this.prepararDadosVenda(venda, produto, cliente, trackingParams, options);

            const response = await axios.post(this.apiUrl, body, {
                headers: {
                    'x-api-token': utmifyToken,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });

            const result = response.data;

            console.log('✅ UTMIFY SUCCESS');
            return { success: true, response: result };

        } catch (error) {
            console.error('❌ UTMIFY EXCEPTION:', error.response?.data || error.message);
            return { success: false, error: error.response?.data?.message || error.message };
        }
    }

    prepararDadosVenda(venda, produto, cliente, trackingParams = {}, options = {}) {
        const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const valorTotal = parseFloat(venda.amount || venda.valor || 0);
        const valorTotalEmCentavos = Math.round(valorTotal * 100);

        return {
            orderId: venda.id || `ped-${Date.now()}`,
            platform: 'MOZCOMPRAS',
            paymentMethod: this.mapearMetodoPagamento(venda.metodo_pagamento || options.provider),
            status: this.mapearStatusPagamento(venda.status || 'paid'),
            createdAt: createdAt,
            approvedDate: createdAt,
            currency: 'MZN',
            customer: {
                name: cliente.name || cliente.nome || 'Cliente',
                email: cliente.email || '',
                phone: this.formatarTelefone(cliente.phone || cliente.telefone || ''),
                ip: cliente.ip || '0.0.0.0'
            },
            products: [{
                id: produto.id,
                name: produto.name || produto.nome,
                quantity: 1,
                priceInCents: valorTotalEmCentavos
            }],
            trackingParameters: {
                utm_source: trackingParams.utm_source || null,
                utm_medium: trackingParams.utm_medium || null,
                utm_campaign: trackingParams.utm_campaign || null,
                utm_content: trackingParams.utm_content || null,
                utm_term: trackingParams.utm_term || null,
                src: trackingParams.src || null,
                sck: trackingParams.sck || null
            },
            commission: {
                totalPriceInCents: valorTotalEmCentavos,
                gatewayFeeInCents: Math.round(valorTotalEmCentavos * 0.05),
                userCommissionInCents: Math.round(valorTotalEmCentavos * 0.95)
            }
        };
    }

    mapearMetodoPagamento(metodo) {
        if (!metodo) return 'unknown';
        const m = metodo.toLowerCase();
        if (m.includes('cartao') || m.includes('card')) return 'credit_card';
        return 'unknown';
    }

    mapearStatusPagamento(status) {
        if (!status) return 'paid';
        const s = status.toLowerCase();
        if (s.includes('pago') || s.includes('concluido') || s.includes('paid')) return 'paid';
        return 'waiting_payment';
    }

    formatarTelefone(tel) {
        const num = tel.replace(/\D/g, '');
        if (num.startsWith('258')) return num;
        return '258' + num;
    }
}

module.exports = new UTMifyService();
