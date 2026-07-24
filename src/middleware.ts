/**
 * Edge auth guard (ACCEPTANCE #4).
 *
 * Two protections, both enforced BEFORE any page/handler renders so a protected
 * surface never flashes:
 *   1. `/admin/*` (except `/admin/login`) → unauthenticated visitors are
 *      redirected to `/admin/login?next=…` (the login page preserves the target).
 *   2. Mutating `/api/*` (POST/PATCH/PUT/DELETE, except `/api/auth/login`) →
 *      unauthenticated callers get a 401 JSON response.
 *
 * Only `jose` runs here (Edge runtime). Password/bcrypt and DB access stay in the
 * Node route handlers. Read GETs on public `/api/*` are unguarded here; admin GET
 * routes self-guard via `getSession()` in their handlers (defense in depth).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, verifySession } from '@/server/auth/jwt';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  // --- Admin pages -------------------------------------------------------
  if (pathname === '/admin/login') {
    // Already signed in? Skip the login form, go straight to the dashboard.
    if (session) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      url.searchParams.set('next', pathname + search);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // --- Mutating API ------------------------------------------------------
  if (pathname.startsWith('/api/') && MUTATING_METHODS.has(req.method)) {
    if (pathname === '/api/auth/login') return NextResponse.next();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }
  }

  return NextResponse.next();
}

/**
 * Run only where a decision is possible. Static assets and `_next` are excluded
 * by scoping the matcher to `/admin` and `/api` subtrees.
 */
export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/:path*'],
};
