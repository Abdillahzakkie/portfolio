/**
 * POST /api/auth/login — exchange email + password for a session cookie.
 *
 * Node runtime (bcrypt). This is the ONE mutating route exempt from the
 * middleware auth gate. Login failures are ALWAYS generic ("Invalid email or
 * password") — the response never reveals whether the email exists or the
 * password was wrong.
 */

import { NextResponse } from 'next/server';
import { verifyLogin, createSession } from '@/server/auth';
import { loginSchema } from '../../_lib/validation';
import { handleApiError } from '../../_lib/responses';
import { clientKey, rateLimit } from '../../_lib/rate-limit';

export const runtime = 'nodejs';

const GENERIC_ERROR = 'Invalid email or password';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const limit = rateLimit(`login:${clientKey(req)}`);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again shortly.', code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      // Same generic message for a malformed body — no field-level disclosure.
      return NextResponse.json(
        { error: GENERIC_ERROR, code: 'invalid_credentials' },
        { status: 400 },
      );
    }

    const user = await verifyLogin(parsed.data.email, parsed.data.password);
    if (!user) {
      return NextResponse.json(
        { error: GENERIC_ERROR, code: 'invalid_credentials' },
        { status: 401 },
      );
    }

    await createSession(user);
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
