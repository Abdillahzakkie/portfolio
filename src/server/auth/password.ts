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
// Deep-import the error types (not the barrel) so the `tsx` seed — which imports
// this module for `hashPassword` — does not pull the whole service layer
// (settings.ts → next/cache) into a non-Next runtime.
import { UnauthorizedError, ValidationError } from '@/server/services/errors';

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

/**
 * Change an admin's password. Verifies the CURRENT password against the stored
 * hash before writing a new one. A missing user OR a wrong current password both
 * throw a GENERIC `UnauthorizedError` — the caller shows a single message and
 * never reveals which check failed. `newPassword` must be ≥ 8 chars.
 *
 * The plaintext password and the hash NEVER leave this function (not logged, not
 * returned).
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await connectToDatabase();

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new ValidationError('New password must be at least 8 characters.');
  }

  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !user.passwordHash) {
    // Perform a compare against a dummy hash to keep timing constant.
    await bcrypt.compare(currentPassword, DUMMY_HASH);
    throw new UnauthorizedError('Current password is incorrect.');
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new UnauthorizedError('Current password is incorrect.');

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
}
