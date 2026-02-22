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
            // No projeto Lite, usamos 'utmify_id' como a chave da API
            const utmifyToken = produto.utmify_id;

            if (!utmifyToken) {
                console.log('⚠️ UTMIFY: Produto não possui utmify_id configurado. Pulando envio.');
                return { success: false, skipped: true };
            }

            console.log(`🚀 UTMIFY: Enviando venda ${venda.id} para UTMify...`);

            const body = this.prepararDadosVenda(venda, produto, cliente, trackingParams, options);

            const response = await axios.post(this.apiUrl, body, {
                headers: {
                    'x-api-token': utmifyToken,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            });

            console.log('✅ UTMIFY SUCCESS');
            return { success: true, response: response.data };

        } catch (error) {
            console.error('❌ UTMIFY ERROR:', error.response ? error.response.data : error.message);
            return { success: false, error: error.message };
        }
    }

    prepararDadosVenda(venda, produto, cliente, trackingParams = {}, options = {}) {
        const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const valorTotal = parseFloat(venda.amount || venda.valor || 0);
        const valorTotalEmCentavos = Math.round(valorTotal * 100);

        return {
            orderId: venda.id,
            platform: 'MOZCOMPRAS',
            paymentMethod: this.mapearMetodoPagamento(venda.metodo_pagamento || options.provider),
            status: 'paid', // Chamado após sucesso
            createdAt: createdAt,
            approvedDate: createdAt,
            currency: 'MZN',
            customer: {
                name: cliente.name || 'Cliente',
                email: cliente.email || '',
                phone: this.formatarTelefone(cliente.phone || ''),
                ip: cliente.ip || '0.0.0.0'
            },
            products: [{
                id: produto.id,
                name: produto.name,
                quantity: 1,
                priceInCents: valorTotalEmCentavos
            }],
            trackingParameters: {
                utm_source: trackingParams.utm_source || null,
                utm_medium: trackingParams.utm_medium || null,
                utm_campaign: trackingParams.utm_campaign || null
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
        if (m.includes('mpesa')) return 'unknown';
        if (m.includes('emola')) return 'unknown';
        return 'unknown';
    }

    formatarTelefone(tel) {
        const num = tel.replace(/\D/g, '');
        if (num.startsWith('258')) return num;
        return '258' + num;
    }
}

module.exports = new UTMifyService();
