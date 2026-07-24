import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * ACCEPTANCE #4 — CMS end-to-end + auth enforcement.
 *
 * WHAT PASSES (real, working behaviour):
 *  - Unauthenticated /admin/* redirects to login; unauthenticated mutating /api/*
 *    returns 401 (direct-request verification).
 *  - Admin logs in through the real form and reaches the dashboard.
 *  - The create → draft(private) → publish(public) LIFECYCLE works when driven
 *    through the authenticated session API (backend/service layer is correct).
 *
 * WHAT IS BROKEN (documented as KNOWN-FAIL + reported to the orchestrator):
 *  - Saving a post through the EDITOR UI with the default "Auto from project"
 *    domain sends `domain: ""`, which the API's postDraftSchema rejects → 400.
 *    (emptyDraft().domain === '' and listProjectOptions() carries no domain, so
 *    picking a project never fills it.)
 *  - Even when a save succeeds, the admin client api.ts mis-unwraps the
 *    {post:{...}} response (reads `.id` instead of `.post.id`), so the editor's
 *    URL becomes /admin/posts/undefined and the in-UI Publish button targets
 *    /api/posts/undefined/publish → 404.
 *
 * Created posts use a `qa-e2e-*` title and are deleted in teardown.
 */

const ADMIN_EMAIL = 'admin@local.test';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'LocalDev!2026';
const BASE_URL = 'http://localhost:3200';
const LINKED_PROJECT = 'managerenta';

// Track everything we create so teardown removes it even if an assertion fails.
const createdIds: string[] = [];

test.afterAll(async () => {
  if (createdIds.length === 0) return;
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
  await ctx.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  for (const id of createdIds) {
    const del = await ctx.delete(`/api/posts/${id}`);
    expect([200, 404]).toContain(del.status());
  }
  await ctx.dispose();
  createdIds.length = 0;
});

test.describe('#4 — auth enforcement (direct request)', () => {
  test('unauthenticated GET /admin redirects to /admin/login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL('**/admin/login**');
    expect(new URL(page.url()).pathname).toBe('/admin/login');
  });

  test('unauthenticated POST /api/posts is rejected with 401', async ({ request }) => {
    const res = await request.post('/api/posts', {
      data: { title: 'nope', slug: 'nope-nope', body: 'x' },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('#4 — CMS: login + create → draft(private) → publish(public)', () => {
  test('admin logs in via the form and reaches the dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('[data-testid="admin-login-form"]')).toBeVisible();
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/admin');
    await expect(page.locator('[data-testid="post-table"]')).toBeVisible();
  });

  test('create → draft is private → publish → public, via the authenticated session', async ({
    page,
  }) => {
    // Log in through the UI so the browser context carries a real session cookie.
    await page.goto('/admin/login');
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/admin');

    // Title is intentionally NOT a substring of the slug: the not-found page's RSC
    // payload echoes the requested URL slug, so a slug-shaped title would create a
    // false "leak". A spaced title only appears if the real post actually renders.
    const stamp = Date.now();
    const title = `QA E2E ${stamp} draft heading`;
    const slug = `qa-e2e-${stamp}`;

    // Create (session cookie rides along on page.request). New posts are drafts.
    const createRes = await page.request.post('/api/posts', {
      data: {
        title,
        // Body deliberately has no top-level `#` heading (that would render a
        // second <h1> and is unrelated to what we're verifying).
        body: 'Enough body content here to satisfy the publish gate. '.repeat(6),
        slug,
        projectSlug: LINKED_PROJECT,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { post: { id: string; slug: string; status: string } };
    createdIds.push(created.post.id);
    expect(created.post.status).toBe('draft');

    // Draft is NOT publicly visible: the post's content is not served at its slug.
    const draftBody = await (await page.request.get(`/blog/${slug}`)).text();
    expect(draftBody).not.toContain(title);
    expect(draftBody).not.toContain('data-testid="post-project-backlink"');

    // Publish.
    const pubRes = await page.request.post(`/api/posts/${created.post.id}/publish`);
    expect(pubRes.status()).toBe(200);

    // Now publicly visible at its slug, rendering title + project backlink.
    const liveRes = await page.goto(`/blog/${slug}`);
    expect(liveRes?.status()).toBe(200);
    const h1 = page.getByRole('heading', { level: 1, name: title });
    await expect(h1).toBeVisible();
    await expect(page.locator('[data-testid="post-project-backlink"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="post-project-backlink"]').first()).toHaveAttribute(
      'href',
      `/projects/${LINKED_PROJECT}`,
    );
  });

  // FIXED: the editor now strips the UI-only domain field (and the schema coerces
  // ""→null), so Save persists a post through the UI in the default flow.
  test('editor Save persists a post via the UI', async ({
    page,
  }) => {
    await page.goto('/admin/login');
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/admin');

    const title = `qa-e2e-ui-${Date.now()}`;
    await page.goto('/admin/posts/new');

    // The editor autosaves on blur, so the create POST can fire the moment a
    // field loses focus (not only on the explicit Save click). Start listening
    // BEFORE filling so we catch the create whenever it lands — otherwise the
    // post already has an id by the time Save runs and Save issues a PATCH.
    const createResP = page.waitForResponse(
      (r) => r.url().includes('/api/posts') && r.request().method() === 'POST',
    );
    await page.fill('[data-testid="editor-title"]', title);
    await page.fill('[data-testid="editor-body"]', 'Body content for the UI save path. '.repeat(6));
    await page.selectOption('[data-testid="editor-project"]', LINKED_PROJECT);
    await page.getByTestId('editor-save').click();

    const createRes = await createResP;
    const body = (await createRes.json()) as { post?: { id?: string } };
    if (body.post?.id) createdIds.push(body.post.id); // teardown tracking
    expect(createRes.status()).toBe(201);
  });
});
