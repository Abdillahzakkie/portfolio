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

  // REGRESSION: after the user is bounced to the login form by a SOFT (client-side)
  // in-app redirect, logging back in must perform a FULL-DOCUMENT navigation to the
  // intended target — the only thing that escapes the poisoned client Router Cache.
  //
  // The bug: while the hydrated admin app is open the session expires; the user
  // clicks an in-app <Link> to a protected page they have not visited; Next's
  // client Router Cache follows the middleware 307 and CACHES a
  // "<target> → /admin/login?next=<target>" redirect entry. The pre-fix login did a
  // SOFT `router.replace(next); router.refresh()`, which re-enters that poisoned
  // cache — the user is bounced back to /admin (deep-link lost) or stranded on the
  // login form. The fix does `window.location.replace(next)`: a full-document
  // navigation that re-runs middleware with the fresh cookie and bypasses the cache.
  //
  // WHY THE ASSERTION IS "the login caused a full-document navigation" rather than
  // "the final URL is <target>": the pre-fix soft-navigation outcome is a RACE
  // between the poisoned redirect replaying and the just-set cookie enabling a
  // refetch, so the final URL is environment-timing-dependent (observed both
  // /admin AND a transient <target> under the Playwright harness) — a URL assertion
  // would be flaky. The full-document navigation, by contrast, is the fix's
  // DETERMINISTIC, browser-observable contract and the exact mechanism that fixes
  // the bug. We detect it with a sentinel planted on the login document: a soft
  // router.replace preserves it; a full-document window.location.replace discards
  // it. Empirically verified toggle (production build, seeded DB):
  //   pre-fix  (router.replace + refresh) → sentinel survives → FAILS
  //   post-fix (window.location.replace)  → sentinel discarded → PASSES
  //
  // CRITICAL SETUP: entry into the login form MUST be an in-app <Link> click (a
  // client-side SOFT navigation), NOT page.goto — a hard navigation follows the 307
  // at the network layer and the Router Cache initializes directly on /admin/login,
  // never holding the stale "<target> → /admin/login" entry the bug depends on. The
  // target must also be a route NOT already cached (a soft nav to the already-cached
  // /admin is served from cache and never re-checks auth, so it can't seed the
  // poison) — hence we deep-link into an unvisited post editor.
  test('login after a soft in-app redirect performs a full-document navigation to the target', async ({
    browser,
  }) => {
    // Fresh, unauthenticated context so nothing is pre-seeded.
    const context = await browser.newContext({ baseURL: BASE_URL });
    await context.clearCookies();
    const page = await context.newPage();
    try {
      // 1) Log in normally and land on the hydrated dashboard (client router live).
      await page.goto('/admin/login');
      await page.fill('#login-email', ADMIN_EMAIL);
      await page.fill('#login-password', ADMIN_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL('**/admin');
      await expect(page.locator('[data-testid="post-table"]')).toBeVisible();

      // A real post-detail route we have NOT visited: its full content is not in
      // the client Router Cache, so navigating to it forces an RSC fetch that
      // actually reaches middleware (unlike a soft nav to the already-cached
      // /admin, which is served from cache and never re-checks the session).
      const row = page.locator('table a[href^="/admin/posts/"]').first();
      const targetPath = await row.getAttribute('href');
      expect(targetPath).toMatch(/^\/admin\/posts\/[a-f0-9]+$/);

      // 2) Session expires mid-app (simulates refresh-token expiry).
      await context.clearCookies();

      // 3) SOFT client-side navigation via the in-app <Link>: RSC fetch →
      //    cookieless middleware 307 → /admin/login?next=<target> → the client
      //    Router Cache stores that poisoned redirect and we land on the login
      //    form. page.goto CANNOT seed this (see header comment).
      await row.click();
      await page.waitForURL('**/admin/login**');
      expect(new URL(page.url()).pathname).toBe('/admin/login');
      expect(new URL(page.url()).searchParams.get('next')).toBe(targetPath);
      await expect(page.locator('[data-testid="admin-login-form"]')).toBeVisible();

      // 4) Plant a sentinel on the current (login) document, then log back in. A
      //    soft router.replace keeps the same document (sentinel survives); the
      //    full-document window.location.replace fix loads a fresh document
      //    (sentinel discarded).
      await page.evaluate(() => {
        (window as unknown as Record<string, unknown>).__loginDocSentinel = 'alive';
      });
      await page.fill('#login-email', ADMIN_EMAIL);
      await page.fill('#login-password', ADMIN_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();

      // Reaches the intended deep-link target (functional check).
      await page.waitForURL(`**${targetPath}`, { timeout: 15_000 });
      expect(new URL(page.url()).pathname).toBe(targetPath);
      await expect(page.locator('[data-testid="editor-title"]')).toBeVisible();

      // Regression discriminator: the login must have replaced the document. The
      // pre-fix soft navigation leaves the sentinel intact → this FAILS.
      const sentinel = await page.evaluate(
        () => (window as unknown as Record<string, unknown>).__loginDocSentinel,
      );
      expect(sentinel).toBeUndefined();
    } finally {
      await context.close();
    }
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
