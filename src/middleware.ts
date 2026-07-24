/**
 * Edge auth guard (ACCEPTANCE #4) + silent access-token reauth.
 *
 * Two protections, both enforced BEFORE any page/handler renders so a protected
 * surface never flashes:
 *   1. `/admin/*` (except `/admin/login`) → unauthenticated visitors are
 *      redirected to `/admin/login?next=…` (the login page preserves the target).
 *   2. Mutating `/api/*` (POST/PATCH/PUT/DELETE, except `/api/auth/login` and
 *      `/api/auth/refresh`) → unauthenticated callers get a 401 JSON response.
 *
 * Silent reauth: on a guarded request we verify the ACCESS cookie. If it is
 * missing/expired/invalid BUT the REFRESH cookie verifies, we mint a fresh 1h
 * access token, set it on the response cookies AND forward it on the request
 * (`NextResponse.next({ request })` with the updated cookie) so the SAME request's
 * server components/handlers already see the new session. Only if BOTH are invalid
 * do we fall back to redirect / 401.
 *
 * Only `jose` runs here (Edge runtime). Password/bcrypt and DB access stay in the
 * Node route handlers. Read GETs on public `/api/*` are unguarded here; admin GET
 * routes self-guard via `getSession()` in their handlers (defense in depth).
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
  accessCookieOptions,
  refreshAccessToken,
  verifyAccessToken,
  type SessionClaims,
} from '@/server/auth/jwt';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;

  // 1) Try the access cookie.
  const accessToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  let session: SessionClaims | null = accessToken
    ? await verifyAccessToken(accessToken)
    : null;

  // 2) Access missing/expired/invalid → try to silently re-mint from refresh.
  let mintedAccessToken: string | null = null;
  if (!session) {
    const refreshToken = req.cookies.get(AUTH_REFRESH_COOKIE_NAME)?.value;
    if (refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        session = refreshed.claims;
        mintedAccessToken = refreshed.token;
      }
    }
  }

  /**
   * Allow the request through. When we minted a new access token, forward it on
   * the REQUEST (so this same request's RSC/handlers read the new session) and set
   * it on the RESPONSE (so the browser stores it for subsequent requests).
   */
  const allow = (): NextResponse => {
    if (!mintedAccessToken) return NextResponse.next();
    req.cookies.set(AUTH_COOKIE_NAME, mintedAccessToken);
    const res = NextResponse.next({ request: req });
    res.cookies.set(AUTH_COOKIE_NAME, mintedAccessToken, accessCookieOptions());
    return res;
  };

  /** Attach a freshly-minted access cookie to a redirect response, if any. */
  const withMinted = (res: NextResponse): NextResponse => {
    if (mintedAccessToken) {
      res.cookies.set(AUTH_COOKIE_NAME, mintedAccessToken, accessCookieOptions());
    }
    return res;
  };

  // --- Admin pages -------------------------------------------------------
  if (pathname === '/admin/login') {
    // Already signed in? Skip the login form, go straight to the dashboard.
    if (session) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      return withMinted(NextResponse.redirect(url));
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
    return allow();
  }

  // --- Mutating API ------------------------------------------------------
  if (pathname.startsWith('/api/') && MUTATING_METHODS.has(req.method)) {
    // Login and refresh are the bootstrap routes — never gated here.
    if (pathname === '/api/auth/login' || pathname === '/api/auth/refresh') {
      return NextResponse.next();
    }
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'unauthorized' },
        { status: 401 },
      );
    }
    return allow();
  }

  return allow();
}

/**
 * Run only where a decision is possible. Static assets and `_next` are excluded
 * by scoping the matcher to `/admin` and `/api` subtrees.
 */
export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/:path*'],
};
