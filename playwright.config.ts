import { defineConfig, devices } from '@playwright/test';

/**
 * QA Playwright config (owned by qa-engineer). Drives a PRODUCTION build
 * (`next start` on :3200) so `notFound()` yields a real 404 for draft posts —
 * `next dev` serves those as 200 (documented App-Router dev streaming behaviour),
 * which would make ACCEPTANCE #3's status assertion a false pass.
 *
 * The server points at the seeded `portfolio` dev db (read-mostly). The one write
 * path exercised (admin create→publish) uses a `qa-e2e-*` title and is deleted in
 * teardown, so the seeded data is left as found.
 *
 * AUTH_SECRET here only needs to be consistent within this running server for
 * login→session→middleware to round-trip; it is unrelated to the seed.
 */
const PORT = 3200;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // login has a per-instance in-memory rate limit; keep it serial
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // Desktop chromium: fine pointer + no touch → the SVG constellation mounts.
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      MONGODB_URI: 'mongodb://localhost:27018/portfolio',
      MONGODB_DB: 'portfolio',
      AUTH_SECRET: 'e2e-fixed-secret-consistent-across-build-and-start-0123456789',
      AUTH_COOKIE_NAME: 'az_session',
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      NODE_ENV: 'production',
    },
  },
});
