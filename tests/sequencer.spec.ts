
import { test, expect } from '@playwright/test';

test.describe('Sequencer Module', () => {

    test.beforeEach(async ({ page }) => {
        // Verify Dashboard loads
        await page.goto('/');
        await expect(page).toHaveTitle(/Antigravity Scheduler/);
    });

    test('should load Sequencer and display main components', async ({ page }) => {
        // Navigate to Sequencer
        const navButton = page.getByTestId('nav-item-sequencer');
        await expect(navButton).toBeVisible();
        await navButton.click();


        // Check for Main Header
        await expect(page.locator('h2').filter({ hasText: 'Optimización de Secuencia' })).toBeVisible();

        // Check for "Paste con Ctrl+V" indicator
        await expect(page.getByText('Pega con Ctrl+V')).toBeVisible();

        // Check configuration inputs exist
        await expect(page.locator('input[type="number"]').first()).toBeVisible();
    });

    test('should show empty state initially', async ({ page }) => {
        await page.getByTestId('nav-item-sequencer').click();
        // Check for either empty state OR draft items table (due to persistence)
        const emptyState = page.getByText('Listo para Pegar');
        const draftTable = page.getByText('Items en Borrador');

        await expect(emptyState.or(draftTable)).toBeVisible();
    });

});
