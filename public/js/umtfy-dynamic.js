// Umtfy Dynamic Integration Script - Lite Project Version
(function () {
    let umtfyIntegracoes = [];
    try {
        umtfyIntegracoes = JSON.parse(localStorage.getItem('umtfyIntegracoes') || '[]');
    } catch (e) { }

    if (!umtfyIntegracoes.length) return;

    window.UmtfySDK = window.UmtfySDK || {
        init: function (apiKey) { console.log('Umtfy Init:', apiKey); return true; },
        trackEvent: function (name, data) { console.log('Umtfy Event:', name, data); return true; }
    };

    umtfyIntegracoes.forEach(i => {
        UmtfySDK.init(i.apiKey);
        const path = window.location.pathname;
        if (path.includes('thank-you') || path.includes('sucesso')) {
            UmtfySDK.trackEvent('purchase', { id: i.produtoId, name: i.produtoNome });
        }
    });
})();
