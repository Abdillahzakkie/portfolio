import { test, expect, request as pwRequest, type Page } from '@playwright/test';

/**
 * Admin Settings — end-to-end through the real UI (Phase-3 tester runs this).
 *
 * Flow: sign in → /admin/settings renders the account + site sections → change the
 * display name (persists) → change a site-settings field (persists) → the password
 * sub-form: a WRONG current password shows a generic error and changes nothing;
 * the CORRECT current password succeeds.
 *
 * Credentials are never hardcoded beyond the same env fixture admin-cms.spec uses
 * (SEED_ADMIN_PASSWORD || 'LocalDev!2026'). The password test is self-healing: it
 * changes the password to a temp value and then changes it back, and registers a
 * teardown that force-restores the original via the API even if a step fails — so
 * the seeded admin login is left exactly as found.
 */

const ADMIN_EMAIL = 'admin@local.test';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'LocalDev!2026';
const BASE_URL = 'http://localhost:3200';

// The current password after the suite runs — teardown restores the original.
let currentPassword = ADMIN_PASSWORD;
// The display name observed before the rename, restored in teardown.
let originalDisplayName: string | null = null;

async function signIn(page: Page, password = currentPassword) {
  await page.goto('/admin/login');
  await expect(page.locator('[data-testid="admin-login-form"]')).toBeVisible();
  await page.fill('#login-email', ADMIN_EMAIL);
  await page.fill('#login-password', password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/admin');
}

async function fillIfPresent(page: Page, testId: string, value: string) {
  const el = page.getByTestId(testId);
  if (await el.count()) {
    await el.first().fill(value);
    return true;
  }
  return false;
}

test.afterAll(async () => {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
  // Log in with whatever the password currently is, then restore the original.
  const login = await ctx.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: currentPassword },
  });
  if (login.ok()) {
    if (currentPassword !== ADMIN_PASSWORD) {
      await ctx.post('/api/settings/password', {
        data: { currentPassword, newPassword: ADMIN_PASSWORD },
      });
    }
    if (originalDisplayName) {
      await ctx.patch('/api/settings/account', {
        data: { displayName: originalDisplayName },
      });
    }
  }
  await ctx.dispose();
});

test.describe('admin settings', () => {
  test('the /admin/settings page renders the account + site sections with the nav active', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/admin/settings');

    const activeNav = page.locator('nav[aria-label="Admin sections"] a[aria-current="page"]');
    await expect(activeNav).toHaveText(/Settings/);

    // Both the account (display name) and site (site name) controls are present.
    await expect(page.getByTestId('settings-display-name')).toBeVisible();
    await expect(page.getByTestId('settings-site-name')).toBeVisible();
  });

  test('changing the display name persists across a reload', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/settings');

    const field = page.getByTestId('settings-display-name');
    originalDisplayName = (await field.inputValue()) || 'Admin';

    const newName = `QA Admin ${Date.now()}`;
    await field.fill(newName);
    const saveResP = page.waitForResponse(
      (r) => r.url().includes('/api/settings/account') && r.request().method() === 'PATCH',
    );
    await page.getByTestId('settings-account-save').click();
    expect((await saveResP).status()).toBe(200);

    // Persisted: reload and the field still holds the new value.
    await page.reload();
    await expect(page.getByTestId('settings-display-name')).toHaveValue(newName);
  });

  test('changing a site-settings field persists across a reload', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/settings');

    const newSiteName = `QA Portfolio ${Date.now()}`;
    await page.getByTestId('settings-site-name').fill(newSiteName);
    const saveResP = page.waitForResponse(
      (r) => r.url().includes('/api/settings/site') && r.request().method() !== 'GET',
    );
    await page.getByTestId('settings-site-save').click();
    expect((await saveResP).status()).toBe(200);

    await page.reload();
    await expect(page.getByTestId('settings-site-name')).toHaveValue(newSiteName);

    // Restore the seeded default so the site chrome is left as found.
    await page.getByTestId('settings-site-name').fill('Abdullah Zakariyya');
    await page.getByTestId('settings-site-save').click();
  });

  test('password change: a wrong current password shows a generic error and changes nothing', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/admin/settings');

    await fillIfPresent(page, 'settings-current-password', 'definitely-not-the-password');
    await fillIfPresent(page, 'settings-new-password', 'BrandNewPass!123');

    const resP = page.waitForResponse(
      (r) => r.url().includes('/api/settings/password') && r.request().method() === 'POST',
    );
    await page.getByTestId('settings-password-save').click();
    const res = await resP;
    // Generic 401 — the UI must NOT reveal which field was wrong.
    expect(res.status()).toBe(401);
    await expect(page.getByRole('alert')).toBeVisible();

    // Proof it did not change: the ORIGINAL password still logs in.
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
    const login = await ctx.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: currentPassword },
    });
    expect(login.ok()).toBe(true);
    await ctx.dispose();
  });

  test('password change: the correct current password succeeds', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/settings');

    const nextPassword = `Rotated!${Date.now()}`;
    await fillIfPresent(page, 'settings-current-password', currentPassword);
    await fillIfPresent(page, 'settings-new-password', nextPassword);

    const resP = page.waitForResponse(
      (r) => r.url().includes('/api/settings/password') && r.request().method() === 'POST',
    );
    await page.getByTestId('settings-password-save').click();
    expect((await resP).status()).toBe(200);
    currentPassword = nextPassword; // teardown will restore the original

    // The NEW password now logs in a fresh context.
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
    const login = await ctx.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: nextPassword },
    });
    expect(login.ok()).toBe(true);
    await ctx.dispose();
  });
});
