/**
 * Cookie-backed session management (Node runtime — uses `next/headers`).
 *
 * Sets / reads / clears the httpOnly session cookie whose JWT is produced and
 * verified by `./jwt`. Route handlers use these; middleware does NOT (it reads
 * the cookie off the request and calls `verifySession` from `./jwt` directly, to
 * stay Edge-safe).
 */

import { cookies } from 'next/headers';
import type { PublicUser } from '@/server/models';
import {
  AUTH_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
} from './jwt';

const isProd = process.env.NODE_ENV === 'production';

/** Sign a token for `user` and set it as the httpOnly session cookie. */
export async function createSession(user: PublicUser): Promise<void> {
  const token = await signSession({
    sub: user._id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd, // allow http in local dev
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

/**
 * The current session's user (hash-free), or null if unauthenticated / invalid.
 * Rebuilt from verified token claims — no DB round-trip on every request.
 */
export async function getSession(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const claims = await verifySession(token);
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

/** Clear the session cookie (logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE_NAME);
}
