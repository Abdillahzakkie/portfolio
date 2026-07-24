/**
 * Edge-safe session JWT helpers — `jose` ONLY (no mongoose, no bcrypt, no
 * next/headers), so this module is importable from `src/middleware.ts` which runs
 * on the Edge runtime. The Node-only cookie plumbing lives in `./session`, the
 * bcrypt password check in `./password`.
 */

import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '@/server/models';

/** Name of the httpOnly session cookie (env-overridable per devops's contract). */
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'az_session';

/** Session lifetime. Matched by the cookie `maxAge` in `./session`. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** The verified claims we carry in the session token. */
export interface SessionClaims {
  /** User id (`sub`). */
  sub: string;
  email: string;
  role: UserRole;
  name?: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set — cannot sign/verify session tokens.');
  }
  return new TextEncoder().encode(secret);
}

/** Sign a session JWT (HS256) for the given claims. */
export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role, name: claims.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verify a session token. Returns the claims on success, or null on any failure
 * (expired, tampered, wrong secret, malformed) — callers treat null as "no
 * session". Never throws for an invalid token.
 */
export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
    });
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      sub: payload.sub,
      email: payload.email,
      role: (payload.role as UserRole) ?? 'admin',
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}
