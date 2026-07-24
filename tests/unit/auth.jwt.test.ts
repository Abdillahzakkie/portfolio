import { describe, it, expect } from 'vitest';
import {
  signSession,
  verifySession,
  type SessionClaims,
} from '@/server/auth/jwt';

/**
 * Edge-safe session JWT (jose HS256). No DB. Verifies the round-trip and — the
 * security-critical half — that a tampered or malformed token yields null, never
 * a forged session. verifySession must never throw for bad input.
 */
const claims: SessionClaims = {
  sub: '507f1f77bcf86cd799439011',
  email: 'admin@local.test',
  role: 'admin',
  name: 'Admin',
};

describe('session JWT round-trip', () => {
  it('signs and verifies its own token back to the same claims', async () => {
    const token = await signSession(claims);
    expect(typeof token).toBe('string');
    const out = await verifySession(token);
    expect(out).not.toBeNull();
    expect(out).toMatchObject({
      sub: claims.sub,
      email: claims.email,
      role: 'admin',
      name: 'Admin',
    });
  });

  it('rejects a token whose signature has been tampered with → null', async () => {
    const token = await signSession(claims);
    const parts = token.split('.');
    // Flip the last char of the signature segment.
    const sig = parts[2];
    const flipped = sig.slice(0, -1) + (sig.at(-1) === 'A' ? 'B' : 'A');
    const tampered = `${parts[0]}.${parts[1]}.${flipped}`;
    expect(tampered).not.toBe(token);
    expect(await verifySession(tampered)).toBeNull();
  });

  it('rejects a token whose payload was swapped (signature no longer matches) → null', async () => {
    const token = await signSession(claims);
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'attacker', email: 'evil@x.com', role: 'admin' }),
    ).toString('base64url');
    const parts = token.split('.');
    const forged = `${parts[0]}.${forgedPayload}.${parts[2]}`;
    expect(await verifySession(forged)).toBeNull();
  });

  it('rejects malformed / garbage tokens without throwing → null', async () => {
    expect(await verifySession('not-a-jwt')).toBeNull();
    expect(await verifySession('')).toBeNull();
    expect(await verifySession('a.b.c')).toBeNull();
  });
});
