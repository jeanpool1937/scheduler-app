import { chromium } from '@playwright/test';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.addInitScript(() => {
        window.localStorage.setItem('scheduler-storage', JSON.stringify({
            state: { activeTab: 'scheduler' },
            version: 1
        }));
    });

    try {
        await page.goto('http://localhost:3000/Sistema-Integrado-de-PCP/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000); // give it time to crash
        const text = await page.evaluate(() => document.body.innerText);
        const html = await page.evaluate(() => document.body.innerHTML);
        console.log('--- DOM TEXT ---');
        console.log(text.substring(0, 1000));
        console.log('--- DOM HTML (Vite-Error-Overlay check) ---');
        console.log(html.includes('vite-error-overlay') ? 'HAS VITE ERROR OVERLAY' : 'NO VITE ERROR OVERLAY');
        if (html.includes('vite-error-overlay')) {
            const overlayHtml = await page.evaluate(() => {
                const overlay = document.querySelector('vite-error-overlay');
                return overlay ? overlay.shadowRoot?.innerHTML || overlay.innerHTML : '';
            });
            console.log('Overlay HTML:', overlayHtml);
        }
    } catch (e) {
        console.log('Navigation failed:', e);
    }

    await browser.close();
})();
