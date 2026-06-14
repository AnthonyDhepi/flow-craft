import { expect, test } from '@playwright/test';

test.describe('FlowCraft', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('starts on the home page and opens a blank editor', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /start from a clean canvas/i })).toBeVisible();
    await page.getByRole('button', { name: /new blank chart/i }).click();
    await expect(page.getByLabel('Diagram name')).toHaveValue(/untitled flow/i);
    await expect(page.getByRole('button', { name: /process step/i })).toBeVisible();
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('adds a node from the library and updates metrics', async ({ page }) => {
    await page.getByRole('button', { name: /new blank chart/i }).click();
    const nodesMetric = page.locator('.metric-card').filter({ hasText: 'Nodes' });
    await expect(nodesMetric).toContainText('0');

    await page.getByRole('button', { name: /Data \/ Input/i }).click();

    await expect(nodesMetric).toContainText('1');
  });
});
