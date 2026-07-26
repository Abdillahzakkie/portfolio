/**
 * PATCH /api/settings/account — update the signed-in admin's display name.
 *
 * After persisting the new name we RE-ISSUE the session so the JWT `name` claim
 * (rebuilt from the token on every request, not the DB) tracks the change. Gated
 * by the middleware; `requireAdmin` also resolves WHICH user to update — the id
 * comes from the verified session, never the request body.
 */

import { NextResponse } from 'next/server';
import { createSession } from '@/server/auth';
import { updateProfile } from '@/server/services';
import { requireAdmin } from '../../_lib/guard';
import { accountSchema } from '../../_lib/validation';
import { badRequest, handleApiError } from '../../_lib/responses';

export const runtime = 'nodejs';

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const session = await requireAdmin();
    const body = await req.json().catch(() => null);
    const parsed = accountSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Invalid account payload.');
    }

    const updated = await updateProfile(session._id, parsed.data.displayName);
    // Re-mint both cookies so the token's `name` claim reflects the new value.
    await createSession(updated);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
