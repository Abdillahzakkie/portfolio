/**
 * Auth barrel for NODE consumers (route handlers). Do NOT import this from
 * `src/middleware.ts` — it pulls in bcrypt + next/headers (not Edge-safe).
 * Middleware imports the Edge-safe primitives from `./jwt` directly.
 */

export { verifyLogin, hashPassword } from './password';
export { createSession, getSession, destroySession } from './session';
export {
  AUTH_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
  type SessionClaims,
} from './jwt';
