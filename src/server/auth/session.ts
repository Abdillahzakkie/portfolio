/**
 * Cookie-backed session management (Node runtime — uses `next/headers`).
 *
 * Sets / reads / clears the httpOnly ACCESS + REFRESH cookies whose JWTs are
 * produced and verified by `./jwt`. Route handlers use these; middleware does NOT
 * (it reads the cookies off the request and calls the Edge-safe verifiers from
 * `./jwt` directly). `createSession` issues BOTH cookies; `getSession` reads the
 * ACCESS cookie only (middleware has already refreshed it upstream when possible).
 */

import { cookies } from 'next/headers';
import type { PublicUser } from '@/server/models';
import {
  AUTH_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
  accessCookieOptions,
  refreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
} from './jwt';

/**
 * Issue a fresh session for `user`: sign an access token (1h) and a refresh token
 * (6h) over the same identity and set BOTH httpOnly cookies.
 */
export async function createSession(user: PublicUser): Promise<void> {
  const claims = {
    sub: user._id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(claims),
    signRefreshToken(claims),
  ]);

  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, accessToken, accessCookieOptions());
  store.set(AUTH_REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
}

/**
 * The current session's user (hash-free), or null if unauthenticated / invalid.
 * Reads+verifies the ACCESS cookie only — the middleware already re-minted it from
 * the refresh cookie upstream when the access token had expired. Rebuilt from
 * verified token claims, so no DB round-trip on every request.
 */
export async function getSession(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;

  return {
    _id: claims.sub,
    email: claims.email,
    role: claims.role,
    name: claims.name,
    // Timestamps aren't carried in the token; empty is fine for auth checks.
    createdAt: '',
    updatedAt: '',
  };
}

/** Clear BOTH session cookies (logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE_NAME);
  store.delete(AUTH_REFRESH_COOKIE_NAME);
}
