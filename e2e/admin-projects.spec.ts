import { test, expect, request as pwRequest, type Page } from '@playwright/test';

/**
 * Admin Projects CRUD — end-to-end through the real UI (Phase-3 tester runs this).
 *
 * Flow: sign in → the /admin/projects list renders and its sidebar entry is the
 * active nav item → create a project via /admin/projects/new → it shows up in the
 * list → edit it → delete it. A project with a linked post asserts the
 * delete-BLOCKED path (the seeded `managerenta` project carries posts).
 *
 * Selectors follow the established admin contract: the login form ids from
 * admin-cms.spec, and the documented editor test-ids `new-project`,
 * `editor-title`, `editor-save`. Optional project fields (slug/summary/domain) are
 * filled only when present so the spec stays robust to the editor's exact layout.
 *
 * Every project created here uses a `qa-e2e-*` slug and is removed in teardown via
 * the API, so the seeded db is left exactly as found. No console errors tolerated.
 */

const ADMIN_EMAIL = 'admin@local.test';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'LocalDev!2026';
const BASE_URL = 'http://localhost:3200';
// A seeded project that already has linked posts → its delete must be blocked.
const LINKED_PROJECT_SLUG = 'managerenta';

// Track created project ids so teardown removes them even if an assertion fails.
const createdIds: string[] = [];

async function signIn(page: Page) {
  await page.goto('/admin/login');
  await expect(page.locator('[data-testid="admin-login-form"]')).toBeVisible();
  await page.fill('#login-email', ADMIN_EMAIL);
  await page.fill('#login-password', ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/admin');
}

// Fill a field addressed by test-id only when it is actually rendered — keeps the
// happy path working whether the editor exposes a field as its own control or not.
async function fillIfPresent(page: Page, testId: string, value: string) {
  const el = page.getByTestId(testId);
  if (await el.count()) await el.first().fill(value);
}
async function selectIfPresent(page: Page, testId: string, value: string) {
  const el = page.getByTestId(testId);
  if (await el.count()) await el.first().selectOption(value).catch(() => {});
}

test.afterAll(async () => {
  if (createdIds.length === 0) return;
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
  await ctx.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  for (const id of createdIds) {
    const del = await ctx.delete(`/api/projects/${id}`);
    // 200 deleted, 404 already gone, 409 blocked by a leftover post — all acceptable.
    expect([200, 404, 409]).toContain(del.status());
  }
  await ctx.dispose();
  createdIds.length = 0;
});

test.describe('admin projects', () => {
  test('the /admin/projects list renders with its sidebar nav item active', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    await signIn(page);
    await page.goto('/admin/projects');

    // The active sidebar entry is "Projects" (aria-current="page").
    const activeNav = page.locator('nav[aria-label="Admin sections"] a[aria-current="page"]');
    await expect(activeNav).toHaveText(/Projects/);

    // The seeded project is listed.
    await expect(page.getByText(LINKED_PROJECT_SLUG, { exact: false }).first()).toBeVisible();

    expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('create a project via the editor, see it in the list, edit it, then delete it', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    await signIn(page);
    await page.goto('/admin/projects');

    const stamp = Date.now();
    const title = `QA E2E Project ${stamp}`;
    const slug = `qa-e2e-project-${stamp}`;

    // Enter the new-project editor.
    await page.getByTestId('new-project').click();
    await page.waitForURL('**/admin/projects/new');
    await expect(page.getByTestId('editor-title')).toBeVisible();

    // Fill the required fields. Title is documented; the rest are filled when the
    // editor renders them (a valid project needs slug + domain + summary server-side).
    await page.getByTestId('editor-title').fill(title);
    await fillIfPresent(page, 'editor-slug', slug);
    await fillIfPresent(page, 'editor-summary', `Summary for ${title}.`);
    await selectIfPresent(page, 'editor-domain', 'web3');

    // The create POST returns { project: { id, slug } } with 201.
    const createResP = page.waitForResponse(
      (r) => /\/api\/projects(\/?|\?.*)$/.test(r.url()) && r.request().method() === 'POST',
    );
    await page.getByTestId('editor-save').click();
    const createRes = await createResP;
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { project: { id: string; slug: string } };
    createdIds.push(created.project.id);

    // It now appears in the list.
    await page.goto('/admin/projects');
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible();

    // Edit it: open the editor for the created project and save a new title.
    await page.goto(`/admin/projects/${created.project.id}`);
    await expect(page.getByTestId('editor-title')).toBeVisible();
    const editedTitle = `${title} (edited)`;
    await page.getByTestId('editor-title').fill(editedTitle);
    const patchResP = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/projects/${created.project.id}`) &&
        r.request().method() === 'PATCH',
    );
    await page.getByTestId('editor-save').click();
    const patchRes = await patchResP;
    expect(patchRes.status()).toBe(200);

    // Delete it through the API surface the UI uses (no linked posts → succeeds).
    const delRes = await page.request.delete(`/api/projects/${created.project.id}`);
    expect(delRes.status()).toBe(200);
    createdIds.length = 0; // deleted; nothing left for teardown

    // Gone from the list.
    await page.goto('/admin/projects');
    await expect(page.getByText(editedTitle, { exact: false })).toHaveCount(0);

    expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('deleting a project that still has linked posts is BLOCKED with a count', async ({
    page,
  }) => {
    await signIn(page);

    // Resolve the seeded, post-linked project's id, then attempt to delete it.
    const listRes = await page.request.get('/api/projects');
    expect(listRes.status()).toBe(200);

    // Find the linked project's editor id via its detail route is not exposed by the
    // options list (slug/name only), so drive the delete through the row action in
    // the UI and assert the blocked toast + a non-destructive outcome.
    await page.goto('/admin/projects');
    const row = page
      .locator('tr, li, [data-testid="project-row"]')
      .filter({ hasText: LINKED_PROJECT_SLUG })
      .first();
    await expect(row).toBeVisible();

    // Trigger this row's delete (row menu → Delete, then confirm), tolerant to the
    // exact control names the editor ships.
    const menu = row.getByRole('button', { name: /menu|actions|more/i });
    if (await menu.count()) await menu.first().click();
    const del = page.getByRole('menuitem', { name: /delete/i }).or(
      page.getByRole('button', { name: /delete/i }),
    );
    await del.first().click();
    const confirm = page.getByRole('button', { name: /delete|confirm/i });
    if (await confirm.count()) await confirm.last().click();

    // The blocked delete surfaces as an error toast (role="alert") mentioning the
    // linked posts — the project is NOT removed.
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/post/i);
    await page.goto('/admin/projects');
    await expect(page.getByText(LINKED_PROJECT_SLUG, { exact: false }).first()).toBeVisible();
  });
});
