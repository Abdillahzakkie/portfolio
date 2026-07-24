/**
 * POST /api/auth/logout — clear the session cookie.
 *
 * A mutating route, so the middleware requires an existing session to reach it
 * (an unauthenticated logout is a no-op 401, which is harmless). Node runtime.
 */

import { NextResponse } from 'next/server';
import { destroySession } from '@/server/auth';
import { handleApiError } from '../../_lib/responses';

export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
