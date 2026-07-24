/**
 * Auth barrel for NODE consumers (route handlers). Do NOT import this from
 * `src/middleware.ts` — it pulls in bcrypt + next/headers (not Edge-safe).
 * Middleware imports the Edge-safe primitives from `./jwt` directly.
 */

export { verifyLogin, hashPassword } from './password';
export { createSession, getSession, destroySession } from './session';
export {
  // Cookie names
  AUTH_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
  // TTLs (SESSION_TTL_SECONDS kept as an alias of the access TTL for back-compat)
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  // Signers (signSession is a back-compat alias of signAccessToken)
  signAccessToken,
  signRefreshToken,
  signSession,
  // Verifiers (verifySession is a back-compat alias of verifyAccessToken)
  verifyAccessToken,
  verifyRefreshToken,
  verifySession,
  // Middleware helper + cookie option builders
  refreshAccessToken,
  accessCookieOptions,
  refreshCookieOptions,
  type SessionClaims,
} from './jwt';
