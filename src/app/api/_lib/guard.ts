/**
 * Per-request auth guard for admin API handlers.
 *
 * The Edge middleware already blocks unauthenticated MUTATING `/api/*` calls, but
 * admin GET routes (post list, editor load, slug-check, project options) are NOT
 * mutating and must self-guard here so drafts and admin-only data never leak to
 * an anonymous caller. Authorization is checked per-request, server-side.
 */

import type { PublicUser } from '@/server/models';
import { getSession } from '@/server/auth';
import { UnauthorizedError } from '@/server/services';

/**
 * Resolve the current admin session or throw `UnauthorizedError` (which the route
 * maps to a 401 via `handleApiError`). Returns the hash-free user.
 */
export async function requireAdmin(): Promise<PublicUser> {
  const user = await getSession();
  if (!user) throw new UnauthorizedError();
  return user;
}
