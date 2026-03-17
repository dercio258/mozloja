const { chromium } = require('playwright');

const automationService = {
    async triggerUSSDPush(checkoutUrl, phone, provider) {
        console.log(`[Automation] Starting for ${phone} on ${checkoutUrl}`);
        
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        try {
            console.log(`[Automation] Navigating to ${checkoutUrl}`);
            await page.goto(checkoutUrl, { waitUntil: 'load', timeout: 60000 });

            // Optimized Input Selector from v3.7
            const inputSelector = 'input:not([readonly]):is([type="tel"], [placeholder*="84"], [placeholder*="82"], [placeholder*="86"], [placeholder*="87"], [placeholder*="Número"])';
            
            console.log(`[Automation] Checking for immediate input availability...`);
            const immediateInput = await page.$(inputSelector);
            
            if (!immediateInput) {
                console.log(`[Automation] Selecting method: ${provider}`);
                const selectors = [
                    `.cursor-pointer:has-text("${provider}")`,
                    `button:has-text("${provider.toUpperCase()}")`,
                    `.payment-method:has-text("${provider}")`,
                    `text=${provider.toUpperCase()}`,
                    `text=${provider}`
                ];

                let clicked = false;
                for (const selector of selectors) {
                    try {
                        await page.click(selector, { timeout: 3000 });
                        clicked = true;
                        break;
                    } catch (e) {}
                }
            }

            // Wait for input
            await page.waitForSelector(inputSelector, { timeout: 10000, state: 'visible' }).catch(() => {
                return page.waitForSelector('input:not([readonly])', { timeout: 5000 });
            });

            console.log(`[Automation] Filling phone: ${phone}`);
            await page.fill('input:not([readonly])', phone);

            const submitSelector = 'button:has-text("Pagar"), button:has-text("Confirmar"), button[type="submit"], .btn-primary:has-text("Pagar")';
            await page.click(submitSelector, { timeout: 10000 });

            await page.waitForTimeout(3000);
            return { success: true };
        } catch (error) {
            console.error('[Automation Error]', error.message);
            return { success: false, error: error.message };
        } finally {
            await browser.close();
        }
    }
};

module.exports = automationService;
