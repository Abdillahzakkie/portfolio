/**
 * Edge-safe session JWT helpers — `jose` ONLY (no mongoose, no bcrypt, no
 * next/headers), so this module is importable from `src/middleware.ts` which runs
 * on the Edge runtime. The Node-only cookie plumbing lives in `./session`, the
 * bcrypt password check in `./password`.
 *
 * Auth model (owner-directed): a short-lived ACCESS token (1h) in the primary
 * cookie plus a longer REFRESH token (6h absolute) in a second cookie. The
 * refresh token carries the SAME identity claims so the edge middleware can mint
 * a fresh access token with NO database lookup. Access and refresh tokens are NOT
 * interchangeable — each verifier rejects the other's `typ`.
 */

import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '@/server/models';

/** Name of the httpOnly ACCESS cookie (env-overridable per devops's contract). */
export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'az_session';

/** Name of the httpOnly REFRESH cookie. */
export const AUTH_REFRESH_COOKIE_NAME =
  process.env.AUTH_REFRESH_COOKIE_NAME || 'az_refresh';

/** Access-token lifetime (short — silently re-minted from the refresh token). */
export const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour

/** Refresh-token lifetime — ABSOLUTE max (not sliding); re-login required after. */
export const REFRESH_TTL_SECONDS = 60 * 60 * 6; // 6 hours

/**
 * Back-compat alias kept so existing importers stay valid. It now equals the
 * ACCESS TTL (the cookie other code reasons about is the access cookie).
 */
export const SESSION_TTL_SECONDS = ACCESS_TTL_SECONDS; // 3600

/** Discriminates the two token kinds; verifiers reject a mismatched `typ`. */
type TokenType = 'access' | 'refresh';

/** The verified identity claims we carry in either token. */
export interface SessionClaims {
  /** User id (`sub`). */
  sub: string;
  email: string;
  role: UserRole;
  name?: string;
}

const isProd = process.env.NODE_ENV === 'production';

/** Shared httpOnly cookie flags (same in both runtimes). `secure` only in prod. */
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd, // allow http in local dev
    sameSite: 'lax' as const,
    path: '/',
  };
}

/** Cookie options for the ACCESS cookie (maxAge = access TTL). */
export function accessCookieOptions() {
  return { ...baseCookieOptions(), maxAge: ACCESS_TTL_SECONDS };
}

/** Cookie options for the REFRESH cookie (maxAge = refresh TTL). */
export function refreshCookieOptions() {
  return { ...baseCookieOptions(), maxAge: REFRESH_TTL_SECONDS };
}

/**
 * The HMAC key for HS256. Fails CLOSED when unset, and enforces a minimum length
 * (BLUE-HAT): a short secret makes HS256 offline-brute-forceable → forged admin
 * sessions. 32 chars ≈ the 256-bit key size HS256 assumes.
 */
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set — cannot sign/verify session tokens.');
  }
  if (secret.length < 32) {
    throw new Error(
      'AUTH_SECRET must be at least 32 characters. A short HS256 secret is ' +
        'brute-forceable offline, which would let an attacker forge admin ' +
        'sessions. Set a long random value (e.g. `openssl rand -base64 48`).',
    );
  }
  return new TextEncoder().encode(secret);
}

/** Sign a typed JWT (HS256) for the given identity claims + lifetime. */
async function signToken(
  claims: SessionClaims,
  typ: TokenType,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT({
    email: claims.email,
    role: claims.role,
    name: claims.name,
    typ,
  })
    .setProtectedHeader({ alg: 'HS256', typ })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecretKey());
}

/** Sign a 1h ACCESS token (`typ:'access'`). */
export function signAccessToken(claims: SessionClaims): Promise<string> {
  return signToken(claims, 'access', ACCESS_TTL_SECONDS);
}

/** Sign a 6h REFRESH token (`typ:'refresh'`), same identity claims. */
export function signRefreshToken(claims: SessionClaims): Promise<string> {
  return signToken(claims, 'refresh', REFRESH_TTL_SECONDS);
}

/**
 * Back-compat alias — `signSession` now signs an ACCESS token. Preserved so
 * existing importers (and tests) keep working.
 */
export const signSession = signAccessToken;

/**
 * Verify a token AND require it to be of the expected kind. Returns the claims on
 * success, or null on ANY failure (expired, tampered, wrong secret, malformed, OR
 * a `typ` mismatch — e.g. a refresh token presented where an access token is
 * required). Never throws for an invalid token.
 */
async function verifyTyped(
  token: string,
  expected: TokenType,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
    });
    // Reject cross-use: an access token must not pass as refresh and vice versa.
    if (payload.typ !== expected) return null;
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

/** Verify an ACCESS token. Rejects `typ !== 'access'`. Null on any failure. */
export function verifyAccessToken(token: string): Promise<SessionClaims | null> {
  return verifyTyped(token, 'access');
}

/** Verify a REFRESH token. Rejects `typ !== 'refresh'`. Null on any failure. */
export function verifyRefreshToken(token: string): Promise<SessionClaims | null> {
  return verifyTyped(token, 'refresh');
}

/**
 * Back-compat alias — `verifySession` now verifies the ACCESS token (same
 * behaviour as `verifyAccessToken`). Preserved so existing importers keep working.
 */
export const verifySession = verifyAccessToken;

/**
 * Middleware helper: given a REFRESH token, verify it and (if valid) mint a fresh
 * ACCESS token carrying the same identity. Returns the new token + claims, or null
 * if the refresh token is missing/expired/invalid. No DB lookup — the identity
 * rides in the refresh token itself.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ token: string; claims: SessionClaims } | null> {
  const claims = await verifyRefreshToken(refreshToken);
  if (!claims) return null;
  const token = await signAccessToken(claims);
  return { token, claims };
}
