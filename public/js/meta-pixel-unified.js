/**
 * Meta Pixel Unificado - RatixPay
 * Sistema centralizado para rastreamento de eventos e conversões
 * Versão: 2.1 - Corrigido método track
 */

// Evitar redeclaração da classe
if (typeof window.MetaPixelUnifiedClass !== 'undefined') {
    console.log('⚠️ MetaPixelUnified já foi declarado, ignorando redeclaração');
} else {

    class MetaPixelUnifiedClass {
        constructor() {
            this.config = {
                debug: this.isDebugMode(),
                deduplicateEvents: true,
                autoTrack: true,
                enhancedEcommerce: true
            };

            this.integrations = [];
            this.sentEvents = new Set();
            this.isInitialized = false;

            this.init();
        }

        /**
         * Inicializa o sistema Meta Pixel
         */
        async init() {
            try {
                console.log('🚀 Inicializando Meta Pixel Unificado...');

                // Verificar se estamos na página payment-success e adicionar retry se necessário
                const isPaymentSuccess = window.location.pathname.includes('payment-success') ||
                    window.location.href.includes('payment-success');

                // Carregar integrações
                await this.loadIntegrations();

                // Se estamos em payment-success e não encontramos integrações, tentar novamente após um delay
                if (isPaymentSuccess && this.integrations.length === 0) {
                    console.log('🔄 Payment-success detectado sem integrações, tentando novamente após 1 segundo...');
                    setTimeout(async () => {
                        await this.loadIntegrations();
                        if (this.integrations.length > 0) {
                            console.log('✅ Integrações carregadas na segunda tentativa');
                            // Inicializar pixel após carregar integrações
                            await this.initializePixelFromConfig();
                            // Disparar eventos automáticos
                            this.trackAutomaticEvents();
                        }
                    }, 1000);
                }

                // Carregar script do Facebook
                this.loadFacebookScript();

                // Configurar listeners
                this.setupEventListeners();

                // Disparar eventos automáticos
                this.trackAutomaticEvents();

                // Aguardar carregamento do script do Facebook
                setTimeout(() => {
                    this.detectPageEvents(); // Apenas detecta, não dispara eventos
                    // setupPaymentTracking não é mais necessário - eventos são disparados por dispatchConfiguredEventsForPath
                    this.createPixelHelper();
                }, 1500);

                this.isInitialized = true;
                console.log('✅ Meta Pixel Unificado inicializado com sucesso');

            } catch (error) {
                console.error('❌ Erro ao inicializar Meta Pixel:', error);
                // Em payment-success, tentar novamente após erro
                const isPaymentSuccess = window.location.pathname.includes('payment-success') ||
                    window.location.href.includes('payment-success');
                if (isPaymentSuccess) {
                    console.log('🔄 Tentando reinicializar após erro em payment-success...');
                    setTimeout(async () => {
                        try {
                            await this.loadIntegrations();
                            if (this.integrations.length > 0) {
                                await this.initializePixelFromConfig();
                                this.trackAutomaticEvents();
                            }
                        } catch (retryError) {
                            console.error('❌ Erro ao reinicializar:', retryError);
                        }
                    }, 2000);
                }
            }
        }

        /**
         * Carrega integrações do localStorage e/ou API
         */
        async loadIntegrations() {
            try {
                // Verificar se estamos na página de payment-success
                const isPaymentSuccess = window.location.pathname.includes('payment-success');

                // Verificar se há produto na URL - priorizar carregamento da API
                const urlParams = new URLSearchParams(window.location.search);
                const produtoId = urlParams.get('produto') || urlParams.get('productId') || localStorage.getItem('currentProductId');

                // No payment-success, priorizar localStorage primeiro
                if (isPaymentSuccess) {
                    console.log('🔄 Página de payment-success detectada, carregando do localStorage primeiro...');
                    await this.loadIntegrationsFromLocalStorage();

                    // Se conseguiu carregar do localStorage, não precisa da API
                    if (this.integrations.length > 0) {
                        console.log('✅ Integrações carregadas do localStorage com sucesso');
                        return;
                    }

                    console.log('⚠️ Falha ao carregar do localStorage, tentando API...');
                    await this.loadIntegrationsFromAPI();
                    return;
                }

                if (produtoId) {
                    console.log('🔄 Produto detectado na URL, carregando da API primeiro...');
                    await this.loadIntegrationsFromAPI();

                    // Se conseguiu carregar da API, não precisa do localStorage
                    if (this.integrations.length > 0) {
                        console.log('✅ Integrações carregadas da API com sucesso');
                        return;
                    }

                    console.log('⚠️ Falha ao carregar da API, tentando localStorage...');
                }

                // Tentar múltiplas chaves para compatibilidade
                const keys = ['metaPixels', 'integracoes', 'metaPixelConfig'];
                let integrations = [];

                for (const key of keys) {
                    const data = localStorage.getItem(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (Array.isArray(parsed)) {
                            integrations = parsed;
                            break;
                        } else if (parsed.pixelId) {
                            integrations = [parsed];
                            break;
                        }
                    }
                }

                // Se não encontrou integrações no localStorage e não há produto na URL, tentar carregar da API
                if (integrations.length === 0 && !produtoId) {
                    await this.loadIntegrationsFromAPI();
                    return;
                }

                // Converter para formato unificado
                this.integrations = integrations.map(integration => ({
                    pixelId: integration.pixelId || integration.pixel_id,
                    produtoId: integration.produtoId || integration.produto_id,
                    produtoNome: integration.produtoNome || integration.produto_nome,
                    eventos: integration.eventos || integration.events || ['PageView'],
                    ativo: integration.ativo !== false
                })).filter(integration => integration.pixelId && integration.ativo);

                console.log(`📊 ${this.integrations.length} integrações carregadas`);

            } catch (error) {
                console.warn('⚠️ Erro ao carregar integrações:', error);
                this.integrations = [];
            }
        }

        /**
         * Busca produto usando múltiplas estratégias (public_id, custom_id, id)
         */
        async buscarProdutoMultiplo(produtoId, API_BASE) {
            const estrategias = [
                { nome: 'ID direto', id: produtoId },
                { nome: 'Public ID', id: produtoId },
                { nome: 'Custom ID', id: produtoId }
            ];

            for (const estrategia of estrategias) {
                try {
                    console.log(`🔍 Tentando estratégia: ${estrategia.nome}`);

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout por tentativa

                    const response = await fetch(`${API_BASE}/produtos/public/${estrategia.id}`, {
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const payload = await response.json();
                        console.log(`🔍 Resposta da API (${estrategia.nome}):`, payload);

                        const produto = payload?.produto || payload;
                        console.log(`🔍 Produto extraído (${estrategia.nome}):`, produto);

                        if (produto && produto.id) {
                            console.log(`✅ Produto encontrado via ${estrategia.nome}:`, {
                                id: produto.id,
                                nome: produto.nome,
                                public_id: produto.public_id,
                                custom_id: produto.custom_id,
                                pixel_id: produto.pixel_id
                            });
                            return produto;
                        } else {
                            console.log(`⚠️ ${estrategia.nome} - Produto sem ID válido:`, produto);
                        }
                    } else {
                        console.log(`⚠️ ${estrategia.nome} falhou: ${response.status} ${response.statusText}`);
                    }

                } catch (error) {
                    console.log(`❌ Erro na estratégia ${estrategia.nome}:`, error.message);
                }
            }

            return null;
        }

        /**
         * Carrega integrações da API quando não há dados no localStorage
         */
        async loadIntegrationsFromAPI() {
            try {
                console.log('🔄 Carregando configurações de pixel do banco de dados...');

                // Tentar obter produto ID da URL ou localStorage
                const urlParams = new URLSearchParams(window.location.search);
                const produtoId = urlParams.get('produto') || urlParams.get('productId') || localStorage.getItem('currentProductId');

                if (!produtoId) {
                    console.log('⚠️ Nenhum produto identificado para carregar pixel da API');
                    return;
                }

                console.log(`🔍 Buscando configurações do produto: ${produtoId}`);

                // Garantir API_BASE
                const API_BASE = window.API_BASE || (window.location.origin + '/api');

                // Tentar buscar produto com múltiplas estratégias
                const produto = await this.buscarProdutoMultiplo(produtoId, API_BASE);

                if (!produto) {
                    console.warn('⚠️ Produto não encontrado com nenhuma estratégia de busca');
                    return;
                }

                console.log('📦 Dados do produto carregados:', {
                    id: produto.id,
                    nome: produto.nome,
                    pixel_id: produto.pixel_id,
                    pixel_events: produto.pixel_events
                });

                if (produto.pixel_id) {
                    // Validar Pixel ID (aceita 15-16 dígitos, incluindo zeros à esquerda)
                    if (!/^\d{15,16}$/.test(produto.pixel_id)) {
                        console.warn('⚠️ Pixel ID inválido detectado:', produto.pixel_id);
                        return;
                    }

                    console.log('✅ Pixel ID válido detectado:', produto.pixel_id);

                    // Salvar no localStorage para futuras referências
                    localStorage.setItem('currentProductId', produto.id);
                    localStorage.setItem('currentProductName', produto.nome);
                    localStorage.setItem('currentPixelId', produto.pixel_id);

                    if (produto.pixel_events && Array.isArray(produto.pixel_events)) {
                        localStorage.setItem('currentPixelEvents', JSON.stringify(produto.pixel_events));
                        console.log('✅ Eventos do pixel salvos:', produto.pixel_events);
                    } else {
                        localStorage.removeItem('currentPixelEvents');
                        console.log('ℹ️ Nenhum evento específico configurado para este produto');
                    }

                    // Criar integração
                    this.integrations = [{
                        pixelId: produto.pixel_id,
                        produtoId: produto.id,
                        produtoNome: produto.nome,
                        eventos: produto.pixel_events && Array.isArray(produto.pixel_events)
                            ? ['PageView', ...produto.pixel_events]
                            : ['PageView'],
                        ativo: true
                    }];

                    console.log(`✅ Configuração de pixel carregada com sucesso:`, {
                        pixelId: produto.pixel_id,
                        produtoNome: produto.nome,
                        eventos: this.integrations[0].eventos
                    });

                    // Inicializar pixel imediatamente
                    await this.initializePixelFromConfig();

                } else {
                    console.log('⚠️ Produto não possui pixel_id configurado no banco de dados');
                }

            } catch (error) {
                if (error.name === 'AbortError') {
                    console.warn('⚠️ Timeout ao carregar configurações de pixel da API');
                } else {
                    console.warn('⚠️ Erro ao carregar integrações da API:', error);
                }
            }
        }

        /**
         * Inicializa o pixel com as configurações carregadas
         */
        async initializePixelFromConfig() {
            if (this.integrations.length === 0) {
                console.log('⚠️ Nenhuma integração disponível para inicializar pixel');
                return;
            }

            const integration = this.integrations[0];
            console.log('🔧 Inicializando pixel com configuração:', integration);

            try {
                // Garantir que o script do Facebook está carregado
                await this.loadFacebookScript();

                // Verificar se fbq está disponível
                if (!window.fbq) {
                    console.error('❌ Facebook Pixel (fbq) não está disponível após carregamento');
                    return;
                }

                // Verificar se pixelId está disponível e válido
                if (!integration.pixelId) {
                    console.error('❌ Pixel ID não está disponível na integração');
                    return;
                }

                // Validar formato do Pixel ID
                if (!/^\d{15,16}$/.test(integration.pixelId)) {
                    console.error('❌ Pixel ID inválido na integração:', integration.pixelId);
                    return;
                }

                // Verificar se já foi inicializado (evitar duplicação)
                if (window.fbq && window.fbq._pixelId === integration.pixelId) {
                    console.log(`ℹ️ Pixel ${integration.pixelId} já foi inicializado anteriormente`);
                    return;
                }

                // Inicializar o pixel específico
                console.log(`🎯 Inicializando pixel: ${integration.pixelId}`);

                // Validar novamente antes de inicializar
                if (!integration.pixelId || !/^\d{15,16}$/.test(integration.pixelId)) {
                    console.error('❌ Pixel ID inválido antes da inicialização:', integration.pixelId);
                    return;
                }

                try {
                    window.fbq('init', integration.pixelId);

                    // Marcar como inicializado
                    if (window.fbq) {
                        window.fbq._pixelId = integration.pixelId;
                    }

                    console.log(`✅ Pixel inicializado com sucesso: ${integration.pixelId}`);

                    // Aguardar um pouco para garantir que o pixel foi processado
                    await new Promise(resolve => setTimeout(resolve, 200));

                    // Verificar se o pixel foi realmente inicializado
                    let checkCount = 0;
                    const maxChecks = 10;
                    const checkPixelInit = () => {
                        checkCount++;
                        if (window.fbq && window.fbq._pixelId === integration.pixelId) {
                            console.log('✅ Pixel confirmado como inicializado:', window.fbq._pixelId);
                            return true;
                        } else if (checkCount < maxChecks) {
                            setTimeout(checkPixelInit, 100);
                            return false;
                        } else {
                            console.warn('⚠️ Pixel pode não ter sido inicializado completamente');
                            return false;
                        }
                    };
                    checkPixelInit();

                } catch (initError) {
                    console.error('❌ Erro ao inicializar pixel:', initError);
                    // Tentar novamente após um delay
                    setTimeout(() => {
                        try {
                            if (window.fbq && integration.pixelId) {
                                window.fbq('init', integration.pixelId);
                                window.fbq._pixelId = integration.pixelId;
                                console.log('✅ Pixel inicializado na segunda tentativa');
                            }
                        } catch (retryError) {
                            console.error('❌ Erro na segunda tentativa de inicialização:', retryError);
                        }
                    }, 500);
                    return;
                }

                // Disparar PageView após um pequeno delay para garantir que o pixel foi registrado
                console.log('📊 Disparando PageView...');
                setTimeout(() => {
                    try {
                        if (window.fbq) {
                            window.fbq('track', 'PageView');
                            console.log('✅ PageView disparado automaticamente');
                        }
                    } catch (trackError) {
                        console.error('❌ Erro ao disparar PageView:', trackError);
                    }
                }, 300);

                // Verificar se o pixel foi registrado corretamente
                setTimeout(() => {
                    if (window.fbq && window.fbq.queue) {
                        console.log('📋 Fila do Facebook Pixel:', window.fbq.queue.length, 'eventos');
                    }
                    if (window.fbq && window.fbq._pixelId) {
                        console.log('✅ Facebook Pixel ID confirmado:', window.fbq._pixelId);
                    }
                }, 1000);

            } catch (error) {
                console.error('❌ Erro ao inicializar pixel:', error);
            }
        }

        /**
         * Carrega script do Facebook Pixel
         */
        async loadFacebookScript() {
            if (window.fbq && window.fbq.loaded) {
                console.log('ℹ️ Facebook Pixel já carregado');
                return Promise.resolve();
            }

            return new Promise((resolve, reject) => {
                // Verificar se já está carregando
                if (window._fbqLoading) {
                    console.log('ℹ️ Facebook Pixel já está sendo carregado, aguardando...');
                    const waitForExisting = () => {
                        if (window.fbq && window.fbq.loaded) {
                            resolve();
                        } else if (window._fbqLoading) {
                            setTimeout(waitForExisting, 100);
                        } else {
                            // Se parou de carregar, tentar novamente
                            window._fbqLoading = true;
                            loadScript();
                        }
                    };
                    waitForExisting();
                    return;
                }

                // Marcar como carregando
                window._fbqLoading = true;

                const loadScript = () => {
                    try {
                        // Script base do Facebook
                        !function (f, b, e, v, n, t, s) {
                            if (f.fbq) return; n = f.fbq = function () {
                                n.callMethod ?
                                n.callMethod.apply(n, arguments) : n.queue.push(arguments)
                            };
                            if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
                            n.queue = []; t = b.createElement(e); t.async = !0;
                            t.src = v; s = b.getElementsByTagName(e)[0];
                            s.parentNode.insertBefore(t, s)
                        }(window, document, 'script',
                            'https://connect.facebook.net/en_US/fbevents.js');

                        console.log('📥 Script do Facebook Pixel sendo carregado...');
                    } catch (error) {
                        console.error('❌ Erro ao inserir script do Facebook Pixel:', error);
                        window._fbqLoading = false;
                        reject(error);
                        return;
                    }

                    // Aguardar o script carregar
                    let checkCount = 0;
                    const maxChecks = 100; // 5 segundos (100 * 50ms)
                    const checkLoaded = () => {
                        checkCount++;

                        if (window.fbq && window.fbq.loaded) {
                            console.log('📱 Script do Facebook Pixel carregado com sucesso');
                            window._fbqLoading = false;
                            resolve();
                            return;
                        }

                        if (checkCount >= maxChecks) {
                            console.warn('⚠️ Timeout ao carregar script do Facebook Pixel após', checkCount * 50, 'ms');
                            window._fbqLoading = false;
                            // Não rejeitar, apenas avisar - pode ainda estar carregando
                            if (window.fbq) {
                                console.log('ℹ️ fbq existe mas não está marcado como loaded, continuando...');
                                resolve(); // Resolver mesmo assim se fbq existe
                            } else {
                                reject(new Error('Timeout loading Facebook Pixel script'));
                            }
                            return;
                        }

                        setTimeout(checkLoaded, 50);
                    };

                    // Iniciar verificação após 100ms
                    setTimeout(checkLoaded, 100);
                };

                loadScript();
            });
        }

        /**
         * Carrega integrações do localStorage
         */
        async loadIntegrationsFromLocalStorage() {
            try {
                console.log('🔄 Carregando integrações do localStorage...');

                // Tentar múltiplas chaves para compatibilidade
                const keys = ['metaPixels', 'integracoes', 'metaPixelConfig'];
                let integrations = [];

                for (const key of keys) {
                    const data = localStorage.getItem(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (Array.isArray(parsed)) {
                            integrations = parsed;
                            console.log(`✅ Integrações encontradas em ${key}:`, integrations);
                            break;
                        } else if (parsed.pixelId) {
                            integrations = [parsed];
                            console.log(`✅ Integração encontrada em ${key}:`, integrations);
                            break;
                        }
                    }
                }

                // Se não encontrou nas chaves padrão, tentar chaves específicas do checkout
                if (integrations.length === 0) {
                    const pixelId = localStorage.getItem('currentPixelId');
                    const productId = localStorage.getItem('currentProductId');
                    const productName = localStorage.getItem('currentProductName');
                    const pixelEvents = JSON.parse(localStorage.getItem('currentPixelEvents') || '[]');

                    if (pixelId && /^\d{15,16}$/.test(pixelId)) {
                        integrations = [{
                            pixelId: pixelId,
                            produtoId: productId,
                            produtoNome: productName,
                            eventos: pixelEvents.length > 0 ? pixelEvents : ['PageView', 'Purchase'],
                            ativo: true
                        }];
                        console.log('✅ Integração criada a partir das chaves do checkout:', integrations);
                    }
                }

                if (integrations.length > 0) {
                    this.integrations = integrations;
                    console.log('✅ Integrações carregadas do localStorage:', this.integrations);
                    return true;
                } else {
                    console.log('⚠️ Nenhuma integração encontrada no localStorage');
                    return false;
                }

            } catch (error) {
                console.error('❌ Erro ao carregar integrações do localStorage:', error);
                return false;
            }
        }

        /**
         * Configura listeners para eventos automáticos
         */
        setupEventListeners() {
            // Listener para botões de checkout
            document.addEventListener('click', (e) => {
                const target = e.target.closest('[data-pixel-checkout], .btn-checkout, #finishOrderBtn');
                if (target) {
                    this.trackEvent('InitiateCheckout', this.getCheckoutData());
                }
            });

            // Listener para formulários de pagamento
            document.addEventListener('submit', (e) => {
                if (e.target.matches('[data-pixel-payment], .payment-form')) {
                    this.trackEvent('AddPaymentInfo', this.getPaymentData());
                }
            });

            // Listener para mudanças de página
            window.addEventListener('beforeunload', () => {
                this.trackEvent('PageView', this.getPageData());
            });
        }

        /**
         * Dispara eventos automáticos baseados na página atual
         */
        trackAutomaticEvents() {
            const path = window.location.pathname;
            const urlParams = new URLSearchParams(window.location.search);

            console.log('🎯 Iniciando rastreamento automático de eventos...');
            console.log('📍 Página atual:', path);

            // Garantir que o fbq esteja carregado
            this.loadFacebookScript();

            // Se houver integrações carregadas, usar elas
            if (this.integrations.length > 0) {
                console.log('✅ Usando integrações carregadas do banco de dados:', this.integrations);

                // Garantir que o pixel está inicializado
                const integration = this.integrations[0];
                if (integration.pixelId && /^\d{15,16}$/.test(integration.pixelId) && window.fbq) {
                    // Pixel já foi inicializado em initializePixelFromConfig()
                    console.log(`ℹ️ Pixel ${integration.pixelId} já foi inicializado anteriormente`);
                } else if (integration.pixelId && !/^\d{15,16}$/.test(integration.pixelId)) {
                    console.error('❌ Pixel ID inválido:', integration.pixelId);
                }

                this.trackEvent('PageView', this.getPageData());
                this.dispatchConfiguredEventsForPath(this.integrations[0].eventos, path);
                return;
            }

            // Tentar carregar do localStorage como fallback
            const pixelEvents = JSON.parse(localStorage.getItem("currentPixelEvents") || "[]");
            const pixelId = localStorage.getItem("currentPixelId");
            const produtoId = localStorage.getItem("currentProductId");
            const produtoNome = localStorage.getItem("currentProductName");

            if (pixelId) {
                console.log('🔄 Pixel ID encontrado no localStorage, inicializando...');
                const alreadyIntegrated = this.integrations.some(i => i.pixelId === pixelId);
                if (!alreadyIntegrated) {
                    const isValidId = /^\d{15,16}$/.test(pixelId);
                    try {
                        if (isValidId) {
                            console.log('✅ Pixel ID válido (localStorage):', pixelId);
                            if (window.fbq) {
                                // Verificar se já foi inicializado (evitar duplicação)
                                if (window.fbq._pixelId === pixelId) {
                                    console.log(`ℹ️ Pixel ${pixelId} já foi inicializado anteriormente`);
                                } else {
                                    // Pixel será inicializado em initializePixelFromConfig()
                                    console.log(`ℹ️ Pixel ${pixelId} será inicializado por initializePixelFromConfig()`);
                                }
                            }
                        } else {
                            console.warn('⚠️ Pixel ID inválido detectado (localStorage):', pixelId);
                        }
                    } catch (error) {
                        console.error('❌ Erro ao inicializar pixel:', error);
                    }

                    // Registrar integração em memória
                    const eventosConfigurados = Array.isArray(pixelEvents) && pixelEvents.length > 0
                        ? ['PageView', ...pixelEvents]
                        : ['PageView'];
                    this.integrations.push({
                        pixelId,
                        produtoId: produtoId || undefined,
                        produtoNome: produtoNome || undefined,
                        eventos: eventosConfigurados,
                        ativo: true
                    });

                    this.trackEvent('PageView', this.getPageData());
                    this.dispatchConfiguredEventsForPath(eventosConfigurados, path);
                }
            } else {
                console.log('⚠️ Nenhum pixel configurado - nem no banco nem no localStorage');

                // Na página de sucesso, tentar carregar novamente após um delay
                // para dar tempo dos dados serem carregados
                if (path.includes('payment-success') || path.includes('payment/success')) {
                    const urlParams = new URLSearchParams(window.location.search);
                    const productId = urlParams.get('productId') || urlParams.get('produto');

                    if (productId && this.integrations.length === 0) {
                        console.log('🔄 Tentando carregar pixel novamente na página de sucesso...');
                        setTimeout(async () => {
                            await this.loadIntegrationsFromAPI();
                            if (this.integrations.length > 0) {
                                console.log('✅ Pixel carregado com sucesso, disparando eventos...');
                                const integration = this.integrations[0];
                                this.trackEvent('PageView', this.getPageData());
                                this.dispatchConfiguredEventsForPath(integration.eventos, path);
                            }
                        }, 2000);
                    }
                }
            }
        }

        /**
         * Dispara eventos configurados conforme o caminho atual
         * ESTRUTURA SIMPLIFICADA:
         * - Checkout: apenas InitiateCheckout
         * - Payment-success: apenas Purchase
         */
        dispatchConfiguredEventsForPath(pixelEvents, path) {
            if (!pixelEvents || !Array.isArray(pixelEvents) || pixelEvents.length === 0) {
                console.log('⚠️ Nenhum evento configurado para esta página');
                return;
            }

            // Detectar página de checkout
            const isCheckoutPage = path.includes('checkout') ||
                path.includes('/c/') ||
                window.location.pathname.includes('checkout') ||
                window.location.pathname.includes('/c/') ||
                window.location.href.includes('checkout');

            // Detectar página de sucesso de pagamento
            const isPaymentSuccessPage = path.includes('payment-success') ||
                path.includes('payment/success') ||
                path.includes('sucesso') ||
                path.includes('thank-you') ||
                window.location.href.includes('payment-success') ||
                window.location.href.includes('payment/success') ||
                window.location.href.includes('thank-you') ||
                window.location.pathname.includes('payment-success') ||
                window.location.pathname.includes('thank-you');

            // NO CHECKOUT: Apenas InitiateCheckout
            if (isCheckoutPage) {
                console.log('🛒 Página de checkout detectada, disparando apenas InitiateCheckout');

                // Verificar se InitiateCheckout está configurado ou se deve disparar mesmo assim
                if (pixelEvents.includes('InitiateCheckout') || pixelEvents.includes('all')) {
                    const checkoutData = this.getCheckoutData();
                    console.log('✅ Disparando InitiateCheckout:', checkoutData);
                    this.trackEvent('InitiateCheckout', checkoutData);
                } else {
                    console.warn('⚠️ InitiateCheckout não está configurado, mas vamos disparar no checkout...');
                    const checkoutData = this.getCheckoutData();
                    this.trackEvent('InitiateCheckout', checkoutData);
                }
                return; // Não processar outros eventos no checkout
            }

            // NO PAYMENT-SUCCESS: Apenas Purchase
            if (isPaymentSuccessPage) {
                console.log('💰 Página de sucesso detectada, disparando apenas Purchase');

                // Função para disparar Purchase com retry
                const triggerPurchase = (attempt = 0, maxAttempts = 5) => {
                    const purchaseData = this.getPurchaseData();

                    // Verificar se temos dados mínimos necessários
                    let hasTransactionId = purchaseData.transaction_id &&
                        purchaseData.transaction_id !== 'N/A' &&
                        purchaseData.transaction_id !== 'undefined';
                    let hasValue = purchaseData.value > 0;

                    // Tentar obter transaction_id do DOM se não estiver na URL
                    if (!hasTransactionId) {
                        const transactionElement = document.getElementById('transactionId') ||
                            document.querySelector('[data-transaction-id]') ||
                            document.querySelector('[data-pedido]');
                        if (transactionElement) {
                            purchaseData.transaction_id = transactionElement.textContent?.trim() ||
                                transactionElement.getAttribute('data-transaction-id') ||
                                transactionElement.getAttribute('data-pedido') ||
                                purchaseData.transaction_id;
                            hasTransactionId = purchaseData.transaction_id &&
                                purchaseData.transaction_id !== 'N/A';
                        }
                    }

                    // Tentar obter valor do DOM se não estiver na URL
                    if (!hasValue) {
                        const amountElement = document.querySelector('[data-amount]') ||
                            document.querySelector('.amount-value') ||
                            document.querySelector('#orderAmount') ||
                            document.querySelector('.total-value');
                        if (amountElement) {
                            const amountText = amountElement.textContent || amountElement.getAttribute('data-amount');
                            const amountValue = parseFloat(amountText.replace(/[^0-9,.]/g, '').replace(',', '.'));
                            if (amountValue > 0) {
                                purchaseData.value = amountValue;
                                hasValue = true;
                            }
                        }
                    }

                    // Se temos dados completos, disparar
                    if (hasTransactionId && hasValue) {
                        console.log('📦 Dados completos do Purchase coletados:', purchaseData);
                        this.trackEvent('Purchase', purchaseData);
                        return;
                    }

                    // Se não temos dados completos, tentar novamente
                    if (attempt < maxAttempts) {
                        const delay = (attempt + 1) * 1000;
                        console.log(`⏳ Aguardando dados da transação... (tentativa ${attempt + 1}/${maxAttempts})`);
                        setTimeout(() => triggerPurchase(attempt + 1, maxAttempts), delay);
                    } else {
                        // Última tentativa - disparar mesmo sem todos os dados
                        console.warn('⚠️ Disparando Purchase com dados disponíveis (última tentativa):', purchaseData);
                        if (purchaseData.value > 0 || purchaseData.content_ids?.length > 0) {
                            this.trackEvent('Purchase', purchaseData);
                        } else {
                            console.error('❌ Não foi possível coletar dados suficientes para Purchase');
                        }
                    }
                };

                // Verificar se Purchase está configurado ou se deve disparar mesmo assim
                if (pixelEvents.includes('Purchase') || pixelEvents.includes('all')) {
                    // Disparar após um pequeno delay para garantir que a página carregou
                    setTimeout(() => triggerPurchase(), 500);
                } else {
                    console.warn('⚠️ Purchase não está configurado, mas vamos disparar na página de sucesso...');
                    setTimeout(() => triggerPurchase(), 500);
                }
                return; // Não processar outros eventos no payment-success
            }

            // Outras páginas - não disparar eventos automáticos
            console.log('ℹ️ Página não é checkout nem payment-success, nenhum evento automático será disparado');
        }

        /**
         * Dispara evento para todos os pixels configurados
         */
        trackEvent(eventName, eventData = {}) {
            if (!window.fbq) {
                console.warn('⚠️ Facebook Pixel não carregado');
                return;
            }

            // Verificar deduplicação
            const eventKey = `${eventName}_${JSON.stringify(eventData)}`;
            if (this.config.deduplicateEvents && this.sentEvents.has(eventKey)) {
                console.log(`🔄 Evento duplicado ignorado: ${eventName}`);
                return;
            }

            // Disparar para cada integração
            this.integrations.forEach(integration => {
                if (integration.eventos.includes(eventName) || integration.eventos.includes('all')) {
                    try {
                        const enhancedData = this.enhanceEventData(eventName, eventData, integration);

                        // Validação final de currency antes de enviar (garantia dupla)
                        if (enhancedData.currency) {
                            enhancedData.currency = this.normalizeCurrency(enhancedData.currency);
                        } else {
                            enhancedData.currency = 'MZN'; // Moeda padrão: Metical Moçambicano
                        }

                        // Remover currency se for inválido (não deve acontecer, mas é uma garantia)
                        if (!enhancedData.currency || typeof enhancedData.currency !== 'string' || !/^[A-Z]{3}$/.test(enhancedData.currency)) {
                            console.warn('⚠️ Currency inválido detectado antes de enviar, removendo:', enhancedData.currency);
                            enhancedData.currency = 'MZN'; // Moeda padrão: Metical Moçambicano
                        }

                        window.fbq('track', eventName, enhancedData);

                        if (this.config.debug) {
                            console.log(`📊 Meta Pixel [${integration.pixelId}]: ${eventName}`, enhancedData);
                        }

                        this.sentEvents.add(eventKey);

                    } catch (error) {
                        console.error(`❌ Erro ao disparar evento ${eventName}:`, error);
                    }
                }
            });
        }

        /**
         * Valida e normaliza código de moeda ISO 4217
         */
        normalizeCurrency(currency) {
            // Casos de valor inválido
            if (!currency) {
                return 'MZN'; // Padrão: Metical Moçambicano
            }

            // Se não for string, tentar converter
            if (typeof currency !== 'string') {
                try {
                    currency = String(currency);
                } catch (e) {
                    console.warn('⚠️ Não foi possível converter currency para string:', currency, '- usando MZN');
                    return 'MZN';
                }
            }

            // Remover espaços e converter para maiúsculas
            const normalized = currency.trim().toUpperCase();

            // Verificar se está vazio após trim
            if (!normalized || normalized.length === 0) {
                console.warn('⚠️ Currency vazio após normalização, usando MZN');
                return 'MZN';
            }

            // Validar formato ISO 4217 (exatamente 3 letras maiúsculas)
            if (!/^[A-Z]{3}$/.test(normalized)) {
                console.warn('⚠️ Código de moeda inválido (formato incorreto):', currency, '- usando MZN como padrão');
                return 'MZN';
            }

            // Códigos de moeda válidos comuns (whitelist)
            const validCurrencies = ['USD', 'BRL', 'EUR', 'GBP', 'MZN', 'AOA', 'ZAR', 'KES', 'UGX', 'TZS', 'ETB', 'GHS', 'NGN', 'XOF', 'XAF', 'EGP', 'MAD', 'TND', 'DZD', 'LYD', 'SDG', 'SSP', 'SZL', 'LSL', 'BWP', 'NAD', 'ZMW', 'MWK'];

            // Se está na whitelist, aceitar
            if (validCurrencies.includes(normalized)) {
                return normalized;
            }

            // Se tem formato válido mas não está na lista, aceitar com aviso (pode ser uma moeda legítima não listada)
            console.log('ℹ️ Código de moeda não verificado na lista, mas formato válido:', normalized);
            return normalized;
        }

        /**
         * Melhora dados do evento com informações específicas
         */
        enhanceEventData(eventName, eventData, integration) {
            const enhanced = { ...eventData };

            // Validar e normalizar currency
            enhanced.currency = this.normalizeCurrency(eventData.currency || 'MZN'); // Moeda padrão: Metical Moçambicano
            enhanced.content_type = 'product';

            // Dados específicos por evento
            switch (eventName) {
                case 'Purchase':
                    enhanced.content_name = integration.produtoNome;
                    enhanced.content_ids = [integration.produtoId];
                    enhanced.value = enhanced.value || this.getProductValue();
                    break;

                case 'ViewContent':
                    enhanced.content_name = integration.produtoNome;
                    enhanced.content_ids = [integration.produtoId];
                    enhanced.value = enhanced.value || this.getProductValue();
                    break;

                case 'InitiateCheckout':
                    enhanced.content_name = integration.produtoNome;
                    enhanced.content_ids = [integration.produtoId];
                    enhanced.value = enhanced.value || this.getCheckoutValue();
                    enhanced.num_items = enhanced.num_items || 1;
                    break;

                case 'AddToCart':
                    enhanced.content_name = integration.produtoNome;
                    enhanced.content_ids = [integration.produtoId];
                    enhanced.value = enhanced.value || this.getProductValue();
                    break;
            }

            return enhanced;
        }

        /**
         * Obtém dados da página atual
         */
        getPageData() {
            return {
                page_title: document.title,
                page_location: window.location.href,
                page_referrer: document.referrer,
                timestamp: new Date().toISOString()
            };
        }

        /**
         * Obtém dados do produto atual
         */
        getProductData() {
            const urlParams = new URLSearchParams(window.location.search);
            // Buscar productId de múltiplas fontes
            const produto = urlParams.get('produto');
            const productId = urlParams.get('productId') ||
                produto ||
                window.currentProduct?.id ||
                window.currentProduct?.customId ||
                localStorage.getItem('currentProductId');

            // Buscar nome do produto de múltiplas fontes
            const productName = window.currentProduct?.nome ||
                localStorage.getItem('currentProductName') ||
                'Produto';

            return {
                content_name: productName,
                content_ids: [productId].filter(Boolean), // Remove valores undefined/null
                content_category: window.currentProduct?.categoria || 'digital_product',
                value: this.getProductValue(),
                currency: 'MZN' // Moeda padrão: Metical Moçambicano (formato ISO 4217 válido)
            };
        }

        /**
         * Obtém dados de checkout
         */
        getCheckoutData() {
            const totalElement = document.querySelector('#orderBumpTotalValue, .total-value, #total');
            const value = totalElement ?
                parseFloat(totalElement.textContent.replace(/[^0-9,.]/g, '').replace(',', '.')) :
                this.getProductValue();

            return {
                ...this.getProductData(),
                value: value,
                num_items: this.getOrderBumpCount() + 1
            };
        }

        /**
         * Obtém dados de compra
         */
        getPurchaseData() {
            const urlParams = new URLSearchParams(window.location.search);

            // Buscar transaction_id de múltiplas fontes (prioridade: URL > localStorage > DOM)
            const pedido = urlParams.get('pedido');
            const idpedido = urlParams.get('idpedido');
            const transactionIdFromUrl = pedido || idpedido;

            // Tentar obter do DOM
            const transactionIdFromDOM = document.getElementById('transactionId')?.textContent?.trim() ||
                document.querySelector('[data-transaction-id]')?.getAttribute('data-transaction-id') ||
                document.querySelector('[data-pedido]')?.getAttribute('data-pedido') ||
                document.querySelector('.transaction-id')?.textContent?.trim();

            // Tentar obter do localStorage
            const transactionIdFromStorage = localStorage.getItem('lastTransactionId') ||
                localStorage.getItem('currentTransactionId');

            // Prioridade: URL > DOM > localStorage > fallback
            const transactionId = transactionIdFromUrl ||
                transactionIdFromDOM ||
                transactionIdFromStorage ||
                (pedido ? `pedido_${pedido}` : null) ||
                (idpedido ? `idpedido_${idpedido}` : null);

            // Buscar dados do produto
            const productData = this.getProductData();

            // Obter valor da compra (tentar múltiplas fontes)
            let purchaseValue = this.getPurchaseValue();

            // Se não encontrou valor, tentar do DOM
            if (!purchaseValue || purchaseValue === 0) {
                const amountFromUrl = urlParams.get('amount') || urlParams.get('valor');
                if (amountFromUrl) {
                    purchaseValue = parseFloat(amountFromUrl);
                } else {
                    // Tentar do DOM
                    const amountElement = document.querySelector('[data-amount]') ||
                        document.querySelector('.amount-value') ||
                        document.querySelector('#orderAmount') ||
                        document.querySelector('.total-value');
                    if (amountElement) {
                        const amountText = amountElement.textContent || amountElement.getAttribute('data-amount');
                        purchaseValue = parseFloat(amountText.replace(/[^0-9,.]/g, '').replace(',', '.')) || purchaseValue;
                    }
                }
            }

            // Obter productId de múltiplas fontes
            let productId = productData.content_ids?.[0];
            if (!productId) {
                productId = urlParams.get('productId') ||
                    urlParams.get('produto') ||
                    localStorage.getItem('currentProductId');
            }

            // Validar currency antes de incluir nos dados
            let currency = productData.currency || 'MZN'; // Moeda padrão: Metical Moçambicano
            if (currency && typeof currency === 'string') {
                currency = currency.trim().toUpperCase();
                // Validar formato ISO 4217
                if (!/^[A-Z]{3}$/.test(currency)) {
                    console.warn('⚠️ Código de moeda inválido detectado:', currency, '- usando MZN como padrão');
                    currency = 'MZN';
                }
            } else {
                currency = 'MZN';
            }

            // Criar cópia de productData sem currency para evitar sobrescrita
            const { currency: _, ...productDataWithoutCurrency } = productData;

            const purchaseData = {
                ...productDataWithoutCurrency,
                content_ids: productId ? [productId] : productData.content_ids || [],
                content_type: 'product',
                transaction_id: transactionId,
                value: purchaseValue || 0,
                currency: currency // Currency validado sempre por último para ter prioridade
            };

            // Log detalhado apenas em modo debug
            if (this.isDebugMode()) {
                console.log('🛒 Dados coletados para Purchase:', {
                    transaction_id: transactionId,
                    transaction_sources: {
                        url: transactionIdFromUrl,
                        dom: transactionIdFromDOM,
                        storage: transactionIdFromStorage
                    },
                    value: purchaseValue,
                    currency: purchaseData.currency,
                    productId: productId,
                    content_ids: purchaseData.content_ids,
                    fullData: purchaseData
                });
            }

            return purchaseData;
        }

        /**
         * Obtém dados de pagamento
         */
        getPaymentData() {
            const paymentMethod = document.querySelector('.payment-method.selected')?.getAttribute('data-method');

            return {
                ...this.getCheckoutData(),
                payment_method: paymentMethod,
                currency: 'MZN' // Moeda padrão: Metical Moçambicano
            };
        }

        /**
         * Obtém valor do produto
         */
        getProductValue() {
            if (window.currentProduct) {
                return parseFloat(window.currentProduct.precoComDesconto || window.currentProduct.preco || 0);
            }

            const urlParams = new URLSearchParams(window.location.search);
            return parseFloat(urlParams.get('valor') || urlParams.get('amount') || 0);
        }

        /**
         * Obtém valor de checkout
         */
        getCheckoutValue() {
            const totalElement = document.querySelector('#orderBumpTotalValue');
            if (totalElement) {
                return parseFloat(totalElement.textContent.replace(/[^0-9,.]/g, '').replace(',', '.'));
            }

            return this.getProductValue();
        }

        /**
         * Obtém valor de compra
         */
        getPurchaseValue() {
            const urlParams = new URLSearchParams(window.location.search);
            return parseFloat(urlParams.get('valor') || urlParams.get('amount') || this.getProductValue());
        }

        /**
         * Conta produtos do Order Bump selecionados
         */
        getOrderBumpCount() {
            return window.selectedOrderBumpProducts?.length || 0;
        }

        /**
         * Verifica se está em modo debug
         */
        isDebugMode() {
            return localStorage.getItem('pixelDebug') === 'true' ||
                window.location.hostname === 'localhost' ||
                window.location.search.includes('debug=true');
        }

        /**
         * Método público para disparar eventos customizados
         */
        trackCustomEvent(eventName, eventData = {}) {
            this.trackEvent(eventName, eventData);
        }

        /**
         * Método público para adicionar integração dinamicamente
         */
        addIntegration(integration) {
            this.integrations.push(integration);
            this.loadFacebookScript();
        }

        /**
         * Detecta eventos específicos da página
         * ESTRUTURA SIMPLIFICADA: Não dispara eventos adicionais aqui
         * Os eventos são disparados apenas por dispatchConfiguredEventsForPath
         */
        detectPageEvents() {
            const currentPath = window.location.pathname;
            console.log('🔍 Detectando página:', currentPath);

            // Apenas log de detecção - os eventos são disparados por dispatchConfiguredEventsForPath
            if (currentPath.includes('checkout') || currentPath.includes('/c/')) {
                console.log('🛒 Página de checkout detectada - InitiateCheckout será disparado por dispatchConfiguredEventsForPath');
            } else if (currentPath.includes('payment-success') || currentPath.includes('sucesso') || currentPath.includes('thank-you')) {
                console.log('💰 Página de sucesso detectada - Purchase será disparado por dispatchConfiguredEventsForPath');
            } else {
                console.log('ℹ️ Página não é checkout nem payment-success - nenhum evento será disparado');
            }
        }

        /**
         * Configura rastreamento de pagamento
         * NOTA: Simplificado - não monitora mais o DOM
         * Os eventos são disparados apenas por dispatchConfiguredEventsForPath
         */
        setupPaymentTracking() {
            console.log('ℹ️ setupPaymentTracking chamado, mas eventos são disparados por dispatchConfiguredEventsForPath');
            // Não fazer nada - os eventos são disparados por dispatchConfiguredEventsForPath
        }

        /**
         * Verifica status de pagamento
         * NOTA: Não é mais usado - Purchase é disparado apenas por dispatchConfiguredEventsForPath
         */
        checkPaymentStatus() {
            // Não fazer nada - Purchase é disparado por dispatchConfiguredEventsForPath
        }

        /**
         * Rastreia eventos de checkout
         * NOTA: Este método NÃO é mais usado - InitiateCheckout é disparado apenas por dispatchConfiguredEventsForPath
         * Mantido para compatibilidade, mas não executa nada
         */
        trackCheckoutEvents() {
            console.log('ℹ️ trackCheckoutEvents chamado, mas InitiateCheckout é disparado por dispatchConfiguredEventsForPath');
            // Não fazer nada - o evento é disparado por dispatchConfiguredEventsForPath
        }

        /**
         * Rastreia eventos de sucesso de pagamento
         * NOTA: Este método NÃO é mais usado - Purchase é disparado apenas por dispatchConfiguredEventsForPath
         * Mantido para compatibilidade, mas não executa nada
         */
        trackPaymentSuccessEvents() {
            console.log('ℹ️ trackPaymentSuccessEvents chamado, mas Purchase é disparado por dispatchConfiguredEventsForPath');
            // Não fazer nada - o evento é disparado por dispatchConfiguredEventsForPath
        }

        /**
         * Rastreia visualização de produto
         */
        trackProductView(produtoId) {
            console.log('👁️ Rastreando visualização de produto:', produtoId);

            this.trackEvent('ViewContent', {
                content_ids: [produtoId],
                content_type: 'product',
                value: this.getProductValue(produtoId),
                currency: 'MZN' // Moeda padrão: Metical Moçambicano
            });
        }

        /**
         * Rastreia sucesso de pagamento
         * NOTA: Este método NÃO é mais usado - Purchase é disparado apenas por dispatchConfiguredEventsForPath
         * Mantido para compatibilidade, mas não executa nada
         */
        trackPaymentSuccess() {
            console.log('ℹ️ trackPaymentSuccess chamado, mas Purchase é disparado por dispatchConfiguredEventsForPath');
            // Não fazer nada - o evento é disparado por dispatchConfiguredEventsForPath
        }

        /**
         * Rastreia erro de pagamento
         */
        trackPaymentError() {
            console.log('❌ Rastreando erro de pagamento');

            const produtoId = this.getProductFromCheckout();
            if (produtoId) {
                this.trackEvent('AddToCart', {
                    content_ids: [produtoId],
                    content_type: 'product',
                    value: this.getProductValue(produtoId),
                    currency: 'MZN' // Moeda padrão: Metical Moçambicano
                });
            }
        }

        /**
         * Obtém produto do checkout
         */
        getProductFromCheckout() {
            // Tentar múltiplas formas de detectar o produto
            const urlParams = new URLSearchParams(window.location.search);
            let produtoId = urlParams.get('produto');

            if (!produtoId) {
                // Tentar detectar do DOM
                const productElement = document.querySelector('[data-produto-id], .product-id, #produto-id');
                if (productElement) {
                    produtoId = productElement.dataset.produtoId || productElement.textContent || productElement.value;
                }
            }

            return produtoId;
        }

        /**
         * Obtém dados da transação
         * NOTA: Este método é mantido para compatibilidade.
         * Para dados mais completos, use getPurchaseData().
         */
        getTransactionData() {
            const urlParams = new URLSearchParams(window.location.search);

            // Obter transaction_id de múltiplas fontes
            const pedido = urlParams.get('pedido');
            const idpedido = urlParams.get('idpedido');
            const transactionIdFromUrl = pedido || idpedido ||
                urlParams.get('transaction_id') ||
                urlParams.get('id');

            // Tentar obter do DOM
            const transactionIdFromDOM = document.getElementById('transactionId')?.textContent?.trim() ||
                document.querySelector('[data-transaction-id]')?.getAttribute('data-transaction-id') ||
                document.querySelector('[data-pedido]')?.getAttribute('data-pedido');

            // Prioridade: URL > DOM > localStorage > fallback
            const transactionId = transactionIdFromUrl ||
                transactionIdFromDOM ||
                localStorage.getItem('lastTransactionId') ||
                localStorage.getItem('currentTransactionId') ||
                Date.now().toString();

            // Obter productId
            const productId = urlParams.get('productId') ||
                urlParams.get('produto') ||
                this.getProductFromCheckout() ||
                localStorage.getItem('currentProductId');

            // Obter valor
            let value = this.getProductValue(productId);
            if (!value || value === 0) {
                const amountFromUrl = urlParams.get('amount') || urlParams.get('valor');
                if (amountFromUrl) {
                    value = parseFloat(amountFromUrl);
                }
            }

            // Validar currency
            let currency = 'MZN'; // Moeda padrão: Metical Moçambicano
            if (urlParams.get('currency')) {
                const currencyParam = urlParams.get('currency').trim().toUpperCase();
                if (/^[A-Z]{3}$/.test(currencyParam)) {
                    currency = currencyParam;
                }
            }

            return {
                productId: productId,
                value: value || 0,
                currency: currency,
                transactionId: transactionId
            };
        }

        /**
         * Cria Meta Pixel Helper para debug (apenas em desenvolvimento)
         */
        createPixelHelper() {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('🔧 Meta Pixel Helper ativado (modo desenvolvimento)');

                // Adicionar informações básicas do pixel ao console
                window.metaPixelHelper = {
                    get integrations() { return this._instance.integrations; },
                    get status() { return this._instance.getStatus(); },
                    track: (event, data) => this._instance.trackEvent(event, data),
                    _instance: this,
                    debug: () => {
                        const instance = window.metaPixelHelper._instance;
                        const status = instance.getStatus();
                        const transactionData = instance.getTransactionData();
                        const currentProduct = instance.getProductFromCheckout();

                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                        console.log('🔍 META PIXEL DEBUG INFO');
                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

                        // Status
                        console.log('\n📊 STATUS:');
                        console.log('  ✅ Inicializado:', status.initialized ? 'Sim' : 'Não');
                        console.log('  📦 Integrações ativas:', status.integrations);
                        console.log('  🎯 Pixel IDs:', status.pixels.length > 0 ? status.pixels.join(', ') : 'Nenhum');
                        console.log('  📤 Eventos enviados:', status.eventsSent);
                        console.log('  🐛 Modo debug:', status.debug ? 'Ativo' : 'Desativado');

                        // Produto
                        if (currentProduct) {
                            console.log('\n🛒 PRODUTO ATUAL:');
                            console.log('  ID:', currentProduct);
                            const productInfo = instance.integrations.find(i => i.produtoId || i.produtoNome);
                            if (productInfo) {
                                if (productInfo.produtoNome) {
                                    console.log('  Nome:', productInfo.produtoNome);
                                }
                                if (productInfo.produtoId) {
                                    console.log('  UUID:', productInfo.produtoId);
                                }
                            }
                        } else {
                            console.log('\n🛒 PRODUTO ATUAL: Nenhum produto detectado');
                        }

                        // Transação
                        if (transactionData) {
                            console.log('\n💰 DADOS DA TRANSAÇÃO:');
                            console.log('  ID do Produto:', transactionData.productId || 'N/A');
                            console.log('  Valor:', transactionData.value || 0);
                            console.log('  Moeda:', transactionData.currency || 'N/A');
                            console.log('  ID da Transação:', transactionData.transactionId || 'N/A');
                        }

                        // Integrações detalhadas
                        if (instance.integrations.length > 0) {
                            console.log('\n🔌 INTEGRAÇÕES DETALHADAS:');
                            instance.integrations.forEach((integration, index) => {
                                console.log(`  ${index + 1}. Pixel ID: ${integration.pixelId}`);
                                console.log(`     Produto ID: ${integration.produtoId || 'N/A'}`);
                                console.log(`     Produto Nome: ${integration.produtoNome || 'N/A'}`);
                                console.log(`     Eventos: ${integration.eventos ? integration.eventos.join(', ') : 'N/A'}`);
                                console.log(`     Ativo: ${integration.ativo ? 'Sim' : 'Não'}`);
                            });
                        } else {
                            console.log('\n🔌 INTEGRAÇÕES: Nenhuma integração encontrada');
                        }

                        // Facebook Pixel Status
                        if (window.fbq) {
                            console.log('\n📱 FACEBOOK PIXEL:');
                            console.log('  Status: Carregado');
                            console.log('  Pixel ID Inicializado:', window.fbq._pixelId || 'N/A');
                            if (window.fbq.queue) {
                                console.log('  Eventos na fila:', window.fbq.queue.length);
                            }
                        } else {
                            console.log('\n📱 FACEBOOK PIXEL: Não carregado');
                        }

                        // LocalStorage
                        console.log('\n💾 LOCALSTORAGE:');
                        const storedPixelId = localStorage.getItem('currentPixelId');
                        const storedProductId = localStorage.getItem('currentProductId');
                        const storedProductName = localStorage.getItem('currentProductName');
                        console.log('  Pixel ID:', storedPixelId || 'N/A');
                        console.log('  Product ID:', storedProductId || 'N/A');
                        console.log('  Product Name:', storedProductName || 'N/A');

                        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                        console.log('💡 Use window.metaPixelHelper.track(event, data) para rastrear eventos');
                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    }
                };

                console.log('💡 Use window.metaPixelHelper.debug() para informações detalhadas');
            }
        }

        /**
         * Método público para obter status
         */
        getStatus() {
            return {
                initialized: this.isInitialized,
                integrations: this.integrations.length,
                pixels: [...new Set(this.integrations.map(i => i.pixelId))],
                eventsSent: this.sentEvents.size,
                debug: this.config.debug,
                currentProduct: this.getProductFromCheckout(),
                transactionData: this.getTransactionData()
            };
        }
    }

    // Inicializar automaticamente
    function initializeMetaPixel() {
        try {
            if (typeof window.MetaPixelUnified === 'undefined') {
                window.MetaPixelUnified = new MetaPixelUnifiedClass();
                console.log('✅ MetaPixelUnified instanciado e disponível em window.MetaPixelUnified');

                // Verificar se inicializou corretamente
                const checkInitialization = (attempt = 1, maxAttempts = 3) => {
                    setTimeout(() => {
                        if (window.MetaPixelUnified && window.MetaPixelUnified.isInitialized) {
                            console.log('✅ MetaPixelUnified inicializado com sucesso');
                        } else if (attempt < maxAttempts) {
                            console.warn(`⚠️ MetaPixelUnified não inicializado ainda (tentativa ${attempt}/${maxAttempts}), verificando novamente...`);
                            checkInitialization(attempt + 1, maxAttempts);
                        } else {
                            console.warn('⚠️ MetaPixelUnified pode não ter inicializado corretamente após múltiplas tentativas');

                            // Em payment-success, tentar forçar inicialização se ainda não inicializou
                            const isPaymentSuccess = window.location.pathname.includes('payment-success') ||
                                window.location.href.includes('payment-success');
                            if (isPaymentSuccess && window.MetaPixelUnified) {
                                console.log('🔄 Tentando forçar inicialização em payment-success...');
                                // Tentar carregar integrações novamente
                                if (window.MetaPixelUnified.loadIntegrations) {
                                    window.MetaPixelUnified.loadIntegrations().then(() => {
                                        if (window.MetaPixelUnified.integrations.length > 0) {
                                            window.MetaPixelUnified.initializePixelFromConfig();
                                            window.MetaPixelUnified.trackAutomaticEvents();
                                        }
                                    });
                                }
                            }
                        }
                    }, 2000);
                };

                checkInitialization();
            } else {
                console.log('ℹ️ MetaPixelUnified já existe, usando instância existente');
            }
        } catch (error) {
            console.error('❌ Erro ao inicializar MetaPixelUnified:', error);
            // Tentar novamente após 1 segundo
            setTimeout(() => {
                try {
                    if (typeof window.MetaPixelUnified === 'undefined') {
                        window.MetaPixelUnified = new MetaPixelUnifiedClass();
                        console.log('✅ MetaPixelUnified inicializado na segunda tentativa');
                    }
                } catch (retryError) {
                    console.error('❌ Falha ao inicializar MetaPixelUnified na segunda tentativa:', retryError);

                    // Última tentativa em payment-success
                    const isPaymentSuccess = window.location.pathname.includes('payment-success') ||
                        window.location.href.includes('payment-success');
                    if (isPaymentSuccess) {
                        setTimeout(() => {
                            try {
                                if (typeof window.MetaPixelUnified === 'undefined') {
                                    window.MetaPixelUnified = new MetaPixelUnifiedClass();
                                    console.log('✅ MetaPixelUnified inicializado na terceira tentativa (payment-success)');
                                }
                            } catch (finalError) {
                                console.error('❌ Falha final ao inicializar MetaPixelUnified:', finalError);
                            }
                        }, 2000);
                    }
                }
            }, 1000);
        }
    }

    // Inicializar imediatamente se DOM já está pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 DOM carregado, inicializando MetaPixelUnified...');
            initializeMetaPixel();
        });
    } else {
        // DOM já está pronto, inicializar imediatamente
        console.log('📄 DOM já pronto, inicializando MetaPixelUnified imediatamente...');
        initializeMetaPixel();
    }

    // Também disponibilizar a classe para uso direto
    window.MetaPixelUnifiedClass = MetaPixelUnifiedClass;

    // Garantir que está disponível globalmente
    if (typeof window.MetaPixelUnified === 'undefined') {
        // Última tentativa após 500ms
        setTimeout(() => {
            if (typeof window.MetaPixelUnified === 'undefined') {
                console.warn('⚠️ MetaPixelUnified ainda não foi inicializado, tentando novamente...');
                initializeMetaPixel();
            }
        }, 500);
    }

    // Exportar para uso global
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = MetaPixelUnifiedClass;
    }

} // Fechar o bloco condicional de verificação de redeclaração
