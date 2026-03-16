import { chromium } from '@playwright/test';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', error => {
        console.log('PAGE ERROR STR:', error.message);
        console.log('PAGE ERROR STACK:', error.stack);
    });

    try {
        await page.goto('http://localhost:3000/Sistema-Integrado-de-PCP/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000); // give it time to crash
        const text = await page.evaluate(() => document.body.innerText);
        const html = await page.evaluate(() => document.body.innerHTML);

        if (html.includes('vite-error-overlay')) {
            const overlayHtml = await page.evaluate(() => {
                const overlay = document.querySelector('vite-error-overlay');
                return overlay ? overlay.shadowRoot?.innerHTML || overlay.innerHTML : '';
            });
            console.log('Overlay HTML:', overlayHtml);
        } else {
            console.log('NO VITE OVERLAY. Page innerText:', text.substring(0, 100));
        }
    } catch (e) {
        console.log('Navigation failed:', e);
    }

    await browser.close();
})();
