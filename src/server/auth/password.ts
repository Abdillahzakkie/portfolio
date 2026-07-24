/**
 * Password hashing + login verification (Node runtime — uses `bcryptjs`).
 *
 * Kept OUT of the Edge-safe `./jwt` module: bcrypt is not Edge-compatible and must
 * only be imported from Node route handlers (the login route). The `passwordHash`
 * NEVER leaves this layer — `verifyLogin` returns a hash-free `PublicUser`.
 */

import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/server/db/connect';
import { User, type PublicUser } from '@/server/models';

/** bcrypt cost factor. 12 ≈ ~250ms — a sane interactive-login default. */
const BCRYPT_ROUNDS = 12;

/**
 * A fixed dummy hash so an unknown-email login still performs a bcrypt compare.
 * This equalizes response time between "no such user" and "wrong password",
 * denying an attacker a timing oracle for valid emails. (Hash of a random string;
 * it matches no real password.)
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO3f2n6bC0h3.3Uu3s0U8g1a3d4e5f6g7';

/** Hash a plaintext password for storage. Used by the seed. */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * Verify an email + password against the stored hash.
 * Returns the hash-free `PublicUser` on success, or null on any failure. The
 * caller (login route) must map null to a GENERIC "Invalid email or password"
 * response — never reveal which field was wrong.
 */
export async function verifyLogin(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  await connectToDatabase();

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+passwordHash',
  );

  if (!user || !user.passwordHash) {
    // Perform a compare against the dummy hash to keep timing constant.
    await bcrypt.compare(password, DUMMY_HASH);
    return null;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  // toJSON strips passwordHash (model transform); serialize to the public shape.
  return JSON.parse(JSON.stringify(user.toJSON())) as PublicUser;
}
