/**
 * Shared API response helpers. `_lib` is an underscore-prefixed (private) folder
 * so the App Router never treats it as a route segment.
 */

import { NextResponse } from 'next/server';
import { ServiceError } from '@/server/services';

/**
 * Translate a thrown error into an HTTP response with a stable JSON body.
 * Known `ServiceError`s map to their status + code; anything else is a 500 with a
 * generic message (never leak internals). The real error is logged server-side.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ServiceError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error('[api] unhandled error:', error);
  return NextResponse.json(
    { error: 'Internal server error', code: 'internal_error' },
    { status: 500 },
  );
}

/** 400 with a caller-actionable message (e.g. failed input validation). */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message, code: 'validation_error' }, { status: 400 });
}

/** 401 for a request that requires an authenticated session. */
export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized', code: 'unauthorized' },
    { status: 401 },
  );
}
