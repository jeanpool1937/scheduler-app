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

    await page.addInitScript(() => {
        window.localStorage.setItem('scheduler-storage', JSON.stringify({
            state: { activeTab: 'scheduler' },
            version: 0
        }));
    });

    try {
        await page.goto('http://localhost:3000/scheduler-app/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000); // give it time to crash
    } catch (e) {
        console.log('Navigation failed:', e);
    }

    await browser.close();
})();
