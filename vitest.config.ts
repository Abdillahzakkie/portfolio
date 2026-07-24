import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * QA vitest config (owned by qa-engineer — this is our slice).
 *
 * Integration tests touch the shared Docker Mongo on localhost:27018 but ONLY
 * ever against a throwaway database whose name is `portfolio_vitest_<pid>` — NEVER
 * the app `portfolio` DB. `MONGODB_DB` forces the db name via connect.ts (it
 * passes `dbName` to mongoose.connect, overriding any path in the URI), so even a
 * misread URI cannot land on the real db. The suite asserts the db name before it
 * writes and drops the throwaway db in afterAll.
 */
const TEST_DB = `portfolio_vitest_${process.pid}`;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // One worker: the integration file owns a single cached mongoose connection
    // and drops its throwaway db at the end. Keeps teardown deterministic.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      MONGODB_URI: `mongodb://localhost:27018/${TEST_DB}`,
      MONGODB_DB: TEST_DB,
      AUTH_SECRET: 'vitest-only-secret-not-for-any-real-environment-0123456789abcd',
      AUTH_COOKIE_NAME: 'az_session',
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
