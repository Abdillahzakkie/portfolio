import { test, expect, type ConsoleMessage } from '@playwright/test';

/**
 * ACCEPTANCE #8 (graph home) + #2 (every project reachable) + #3 (posts/sitemap/
 * draft-404) + #5 (responsive). Runs against the production build (see config).
 */

const EXPECTED_PROJECT_COUNT = 18;

// Known seeded slugs (18 published / 7 draft split — stable seed).
const PUBLISHED_POST_SLUG = 'managerenta-reference-architecture';
const PUBLISHED_POST_PROJECT = 'managerenta';
const DRAFT_POST_SLUG = 'settleo-single-writer-ledger-tigerbeetle';
const A_PROJECT_SLUG = 'settleo';
// One of settleo's stack entries — proves the stack region renders on a project page.
const A_PROJECT_STACK_TERM = 'TigerBeetle';

test.describe('#8 / #2 — graph home', () => {
  test('the SSR project list exposes all 18 projects, each linking to /projects/[slug]', async ({
    page,
  }) => {
    await page.goto('/');
    const list = page.locator('[data-testid="project-list"]').first();
    const links = list.locator('a[href^="/projects/"]');
    await expect(links).toHaveCount(EXPECTED_PROJECT_COUNT);

    const hrefs = await links.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href')),
    );
    for (const href of hrefs) expect(href).toMatch(/^\/projects\/[a-z0-9-]+$/);
    expect(new Set(hrefs).size).toBe(EXPECTED_PROJECT_COUNT);
  });

  test('the constellation mounts and renders all 18 nodes at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const nodes = page.locator('[data-testid="constellation"] [data-testid^="node-"]');
    await expect(nodes.first()).toBeVisible();
    await expect(nodes).toHaveCount(EXPECTED_PROJECT_COUNT);

    const hrefs = await nodes.evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-href')),
    );
    for (const href of hrefs) expect(href).toMatch(/^\/projects\/[a-z0-9-]+$/);
  });

  test('clicking a node (pointer) navigates to that project page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const node = page.locator('[data-testid="constellation"] [data-testid^="node-"]').first();
    await expect(node).toBeVisible();
    const href = await node.getAttribute('data-href');
    await node.click();
    await page.waitForURL(`**${href}`);
    expect(new URL(page.url()).pathname).toBe(href);
  });

  test('keyboard: focus the graph, ArrowRight, Enter → lands on a project page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const active = page.locator('[data-testid="constellation"] [data-testid^="node-"][tabindex="0"]');
    await expect(active).toBeVisible();
    await active.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/projects/**');
    expect(new URL(page.url()).pathname).toMatch(/^\/projects\/[a-z0-9-]+$/);
  });

  test('#2 project page: no console errors, H1 name + stack render', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto(`/projects/${A_PROJECT_SLUG}`);
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    expect((await h1.textContent())?.trim().length).toBeGreaterThan(0);

    // Stack chips render (links are omitted in seed content — see report finding).
    await expect(page.getByText(A_PROJECT_STACK_TERM, { exact: false }).first()).toBeVisible();

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('#3 — posts, sitemap, draft 404', () => {
  test('a published post renders title, body, and a backlink to its project', async ({ page }) => {
    await page.goto(`/blog/${PUBLISHED_POST_SLUG}`);
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    expect((await h1.textContent())?.trim().length).toBeGreaterThan(0);

    // Body content present (the article has more than just the heading).
    const article = page.locator('article');
    expect((await article.innerText()).length).toBeGreaterThan(200);

    const backlink = page.locator('[data-testid="post-project-backlink"]').first();
    await expect(backlink).toBeVisible();
    await expect(backlink).toHaveAttribute('href', `/projects/${PUBLISHED_POST_PROJECT}`);
  });

  test('sitemap.xml lists published projects + posts and NOT drafts', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain(`/projects/${PUBLISHED_POST_PROJECT}`);
    expect(xml).toContain(`/blog/${PUBLISHED_POST_SLUG}`);
    // The draft must never appear in the sitemap.
    expect(xml).not.toContain(`/blog/${DRAFT_POST_SLUG}`);
  });

  test('a draft post is NOT served to an anonymous visitor (renders not-found UI, no content)', async ({
    page,
  }) => {
    // Security-critical half of #3: the draft's title/body must never render.
    await page.goto(`/blog/${DRAFT_POST_SLUG}`);
    // The real post structure (backlink banner, published-post <h1>) must be absent.
    await expect(page.locator('[data-testid="post-project-backlink"]')).toHaveCount(0);
    // The draft's actual title must not appear as page content.
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Building a double-entry ledger on TigerBeetle');
    // The shared not-found UI is what renders instead.
    expect(body.toLowerCase()).toContain('nothing here');
  });

  // FIXED: removing the streaming loading.tsx boundary on the dynamic detail
  // routes lets Next resolve notFound() before committing status, so a draft or
  // missing post now returns a real HTTP 404 (ACCEPTANCE #3 status clause + SEO #6).
  test('a draft post slug returns 404 status to anonymous visitors', async ({
    page,
  }) => {
    const res = await page.goto(`/blog/${DRAFT_POST_SLUG}`);
    expect(res?.status()).toBe(404);
  });
});

test.describe('#5 — responsive: no horizontal overflow at 375px and 1440px', () => {
  const routes = ['/', `/projects/${A_PROJECT_SLUG}`, `/blog/${PUBLISHED_POST_SLUG}`];
  for (const route of routes) {
    for (const width of [375, 1440]) {
      test(`${route} @ ${width}px has no horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        // Let layout settle (fonts / hydration).
        await page.waitForLoadState('networkidle');
        const overflow = await page.evaluate(() => {
          const el = document.scrollingElement!;
          return { scrollWidth: el.scrollWidth, innerWidth: window.innerWidth };
        });
        expect(
          overflow.scrollWidth,
          `scrollWidth ${overflow.scrollWidth} > innerWidth ${overflow.innerWidth}`,
        ).toBeLessThanOrEqual(overflow.innerWidth);
      });
    }
  }
});
