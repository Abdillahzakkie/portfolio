import { test, expect, type ConsoleMessage } from '@playwright/test';

/**
 * Mobile navbar regression suite for the public `Header`
 * (src/components/public/Header.tsx).
 *
 * The bug this guards against: the mobile slide-over lived inline inside the
 * `<header>`, whose `backdrop-filter` establishes a containing block for
 * `position: fixed` descendants — so the "full-screen" overlay was clipped to
 * the ~69px header instead of the viewport, the scrim couldn't be tapped, and
 * the background stayed scrollable. The fix portals the overlay to
 * `document.body` and locks body scroll while open.
 *
 * These assertions describe the DESIRED (fixed) behaviour: they FAIL on the old
 * clipped-inline overlay and PASS once it is portaled + scroll-locked.
 *
 * baseURL + the production server come from playwright.config.ts (next start on
 * :3200); we only drive viewport + interactions here.
 */

const MOBILE = { width: 375, height: 720 };
const DESKTOP = { width: 1024, height: 800 };

// A point on the left third of the viewport, well below the header band — on the
// fixed full-viewport scrim but NOT under the right-anchored drawer.
const SCRIM_TAP = { x: 40, y: 360 };

/** Open the mobile drawer and wait for it to be present + visible. */
async function openMenu(page: import('@playwright/test').Page) {
  await page.locator('.az-menu-button').click();
  await expect(page.locator('#mobile-nav')).toBeVisible();
  // No CSS transition on the overlay, but give layout a beat to settle.
  await page.waitForTimeout(100);
}

test.describe('mobile navbar — breakpoints', () => {
  test('@375px the hamburger is visible and the desktop nav is hidden', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.az-menu-button')).toBeVisible();
    await expect(page.locator('.az-nav-desktop')).toBeHidden();
  });

  test('@1024px the hamburger is hidden and the desktop nav is visible', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.az-menu-button')).toBeHidden();
    await expect(page.locator('.az-nav-desktop')).toBeVisible();
  });
});

test.describe('mobile navbar — overlay (the core regression)', () => {
  test('the scrim and drawer both span the full viewport height, not the header', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openMenu(page);

    const scrim = page.locator('.az-nav-mobile-layer > button').first();
    const drawer = page.locator('#mobile-nav');

    const scrimBox = await scrim.boundingBox();
    const drawerBox = await drawer.boundingBox();

    expect(scrimBox, 'scrim should have a bounding box').not.toBeNull();
    expect(drawerBox, 'drawer should have a bounding box').not.toBeNull();

    // On the buggy inline overlay these were ~68px (clipped to the header).
    // Fixed: both cover essentially the whole 720px viewport.
    expect(
      scrimBox!.height,
      `scrim height ${scrimBox!.height} should span the viewport (was ~68px when clipped to the header)`,
    ).toBeGreaterThan(600);
    expect(
      drawerBox!.height,
      `drawer height ${drawerBox!.height} should span the viewport (was ~68px when clipped to the header)`,
    ).toBeGreaterThan(600);
  });
});

test.describe('mobile navbar — dismissal', () => {
  test('tapping the scrim below the header closes the drawer', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openMenu(page);

    // On the old clipped overlay this coordinate hit page content behind the
    // header-sized scrim and never closed the menu.
    await page.mouse.click(SCRIM_TAP.x, SCRIM_TAP.y);

    await expect(page.locator('#mobile-nav')).toBeHidden();
  });

  test('the X button closes the drawer and restores focus to the hamburger', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openMenu(page);

    await page.locator('#mobile-nav button[aria-label="Close menu"]').click();
    await expect(page.locator('#mobile-nav')).toBeHidden();

    const focusedLabel = await page.evaluate(() =>
      document.activeElement?.getAttribute('aria-label'),
    );
    expect(focusedLabel).toBe('Open menu');
  });

  test('Escape closes the drawer and restores focus to the hamburger', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openMenu(page);

    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-nav')).toBeHidden();

    const focusedLabel = await page.evaluate(() =>
      document.activeElement?.getAttribute('aria-label'),
    );
    expect(focusedLabel).toBe('Open menu');
  });
});

test.describe('mobile navbar — scroll-lock', () => {
  test('opening the drawer locks background scroll', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const startY = await page.evaluate(() => window.scrollY);
    await openMenu(page);

    const overflow = await page.evaluate(
      () => getComputedStyle(document.body).overflow,
    );
    expect(overflow, 'body overflow should be hidden while the drawer is open').toBe('hidden');

    // Belt-and-braces: a wheel gesture must not move the page while locked.
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(100);
    const afterY = await page.evaluate(() => window.scrollY);
    expect(afterY, 'background must not scroll while the drawer is open').toBe(startY);
  });
});

test.describe('mobile navbar — navigation', () => {
  test('tapping the Blog link navigates and closes the drawer', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openMenu(page);

    await page.locator('#mobile-nav a[href="/blog"]').click();
    await page.waitForURL('**/blog');
    await page.waitForLoadState('networkidle');

    // Route change unmounts the portal → the drawer is gone.
    await expect(page.locator('#mobile-nav')).toHaveCount(0);
  });
});

test.describe('mobile navbar — no console errors', () => {
  test('open → navigate → close produces no console errors or page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.setViewportSize(MOBILE);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open.
    await openMenu(page);
    // Navigate via a drawer link.
    await page.locator('#mobile-nav a[href="/blog"]').click();
    await page.waitForURL('**/blog');
    await page.waitForLoadState('networkidle');
    // Re-open on the new route and close via Escape.
    await openMenu(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-nav')).toBeHidden();

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
