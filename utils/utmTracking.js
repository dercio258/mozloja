/**
 * Utilitário para captura, normalização e gerenciamento de parâmetros UTM
 * 
 * @module utils/utmTracking
 */

/**
 * Captura e normaliza parâmetros UTM de múltiplas fontes
 * 
 * @param {Object} sources - Fontes de dados UTM
 * @returns {Object} Parâmetros UTM normalizados
 */
function captureUTMParameters(sources = {}) {
    const {
        reqBody = {},
        reqQuery = {},
        analytics = {},
        trackingData = {},
        localStorage = {},
        ip = null
    } = sources;

    const normalize = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const str = String(value).trim();
        return str.length > 0 ? str : null;
    };

    const utmParams = {
        utm_source: normalize(
            reqBody.utm_source ||
            reqBody.utmSource ||
            trackingData.utm_source ||
            reqQuery.utm_source ||
            reqQuery.utmSource ||
            analytics.utmSource ||
            localStorage.utm_source ||
            null
        ),
        utm_medium: normalize(
            reqBody.utm_medium ||
            reqBody.utmMedium ||
            trackingData.utm_medium ||
            reqQuery.utm_medium ||
            reqQuery.utmMedium ||
            analytics.utmMedium ||
            localStorage.utm_medium ||
            null
        ),
        utm_campaign: normalize(
            reqBody.utm_campaign ||
            reqBody.utmCampaign ||
            trackingData.utm_campaign ||
            reqQuery.utm_campaign ||
            reqQuery.utmCampaign ||
            analytics.utmCampaign ||
            localStorage.utm_campaign ||
            null
        ),
        utm_content: normalize(
            reqBody.utm_content ||
            reqBody.utmContent ||
            trackingData.utm_content ||
            reqQuery.utm_content ||
            reqQuery.utmContent ||
            analytics.utmContent ||
            localStorage.utm_content ||
            null
        ),
        utm_term: normalize(
            reqBody.utm_term ||
            reqBody.utmTerm ||
            trackingData.utm_term ||
            reqQuery.utm_term ||
            reqQuery.utmTerm ||
            analytics.utmTerm ||
            localStorage.utm_term ||
            null
        ),
        src: normalize(
            reqBody.src ||
            trackingData.src ||
            reqQuery.src ||
            localStorage.src ||
            null
        ),
        sck: normalize(
            reqBody.sck ||
            trackingData.sck ||
            reqQuery.sck ||
            localStorage.sck ||
            null
        ),
        ip: normalize(ip || trackingData.ip || null)
    };

    utmParams._metadata = {
        captured_at: new Date().toISOString(),
        has_utm_source: !!utmParams.utm_source,
        has_utm_campaign: !!utmParams.utm_campaign,
        has_utm_medium: !!utmParams.utm_medium,
        has_any_utm: !!(utmParams.utm_source || utmParams.utm_campaign || utmParams.utm_medium)
    };

    return utmParams;
}

/**
 * Prepara tracking_data para salvar no banco de dados
 * 
 * @param {Object} utmParams - Parâmetros UTM normalizados
 * @returns {Object} tracking_data pronto para salvar
 */
function prepareTrackingDataForDB(utmParams, options = {}) {
    const trackingData = {
        utm_source: utmParams.utm_source || null,
        utm_medium: utmParams.utm_medium || null,
        utm_campaign: utmParams.utm_campaign || null,
        utm_content: utmParams.utm_content || null,
        utm_term: utmParams.utm_term || null,
        src: utmParams.src || null,
        sck: utmParams.sck || null
    };

    trackingData.updated_at = new Date().toISOString();
    return trackingData;
}

module.exports = {
    captureUTMParameters,
    prepareTrackingDataForDB
};
