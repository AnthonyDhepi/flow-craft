import { expect, test } from '@playwright/test';

test.describe('FlowCraft', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens a blank editor from the dashboard', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /design workflows that explain themselves/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: /new diagram/i }).click();

    await expect(page.getByLabel('Diagram name')).toHaveValue(/untitled flow/i);
    await expect(page.getByRole('button', { name: /process step/i })).toBeVisible();
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('adds a node and reflects it in diagram metrics', async ({ page }) => {
    await page.getByRole('button', { name: /new diagram/i }).click();

    const steps = page.locator('.metric').filter({ hasText: 'Steps' });
    await expect(steps).toContainText('0');

    await page.getByRole('button', { name: /process step/i }).click();

    await page.getByRole('button', { name: 'Diagram', exact: true }).click();
    await expect(steps).toContainText('1');
  });

  test('starts a diagram from a template', async ({ page }) => {
    await page.getByRole('button', { name: /incident response/i }).click();

    await expect(page.getByLabel('Diagram name')).toHaveValue(/incident response/i);
    await expect(page.locator('.react-flow')).toBeVisible();
  });
});
