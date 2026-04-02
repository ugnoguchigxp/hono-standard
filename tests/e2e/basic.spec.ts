import { expect, test } from '@playwright/test';

test.describe('Basic Navigation', () => {
  test('should show home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Welcome to Hono Standard');
  });

  test('should navigate to BBS page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=BBS');
    await expect(page).toHaveURL(/\/bbs/);
    // Check if BBS header exists (assuming it exists in /bbs route)
    await expect(page.locator('h1')).toContainText('BBS');
  });

  test('should navigate to Login page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h1')).toContainText('Login');
  });
});
