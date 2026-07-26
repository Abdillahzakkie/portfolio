/**
 * POST /api/settings/password — change the signed-in admin's password.
 *
 * Rate-limited FIRST (mirrors login — a brute-force speed-bump on the current
 * password). `requireAdmin` runs BEFORE the body is read, so an anonymous caller
 * always gets a 401 (never a validation error that hints the endpoint exists).
 * The user id comes from the verified session, never the request body.
 *
 * A wrong CURRENT password surfaces as a generic 401 (UnauthorizedError → 401 via
 * handleApiError) — the UI shows one message and never reveals which check failed.
 */

import { NextResponse } from 'next/server';
import { changePassword } from '@/server/auth/password';
import { requireAdmin } from '../../_lib/guard';
import { passwordChangeSchema } from '../../_lib/validation';
import { badRequest, handleApiError } from '../../_lib/responses';
import { clientKey, rateLimit } from '../../_lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const limit = rateLimit(`password-change:${clientKey(req)}`);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again shortly.', code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
      );
    }

    // Authenticate BEFORE reading the body so an anonymous caller 401s.
    const session = await requireAdmin();

    const body = await req.json().catch(() => null);
    const parsed = passwordChangeSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Invalid password payload.');
    }

    await changePassword(
      session._id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
