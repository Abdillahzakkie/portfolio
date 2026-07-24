/**
 * POST /api/auth/refresh — client-driven access-token renewal (retry-on-401).
 *
 * Reads the httpOnly REFRESH cookie; if it verifies, mints a fresh 1h ACCESS
 * token, sets it on the access cookie, and returns 200 `{ ok: true }`. If the
 * refresh cookie is missing/expired/invalid, returns 401 (the client should send
 * the user back to login). No DB lookup — identity rides in the refresh token.
 *
 * This route is exempt from the middleware auth gate (like `/api/auth/login`), so
 * a client whose access token has already expired can still reach it. Node runtime.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  AUTH_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
  accessCookieOptions,
  refreshAccessToken,
} from '@/server/auth';
import { handleApiError } from '../../_lib/responses';

export const runtime = 'nodejs';

export async function POST(): Promise<NextResponse> {
  try {
    const store = await cookies();
    const refreshToken = store.get(AUTH_REFRESH_COOKIE_NAME)?.value;

    const refreshed = refreshToken ? await refreshAccessToken(refreshToken) : null;
    if (!refreshed) {
      return NextResponse.json(
        { error: 'Session expired. Please sign in again.', code: 'unauthorized' },
        { status: 401 },
      );
    }

    store.set(AUTH_COOKIE_NAME, refreshed.token, accessCookieOptions());
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
