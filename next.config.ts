import type { NextConfig } from 'next';

/**
 * Next.js config — deliberately minimal.
 *
 * - `reactStrictMode` surfaces effect/lifecycle bugs in dev.
 * - No remote image domains are configured on purpose: the design uses no
 *   external images by default (see docs/design). Add entries to
 *   `images.remotePatterns` only when a real remote host is introduced.
 * - The Markdown render stack (react-markdown + remark/rehype) is pure runtime
 *   code and needs no build/webpack configuration here.
 * - `output: 'standalone'` was removed: it triggers a Next 15 build-trace ENOENT
 *   on Windows (`_not-found/page.js.nft.json`) and is unnecessary for the Vercel
 *   deploy target, which uses its own build output. Reintroduce it only if the
 *   optional self-hosted Dockerfile path is revived (and build on Linux).
 */
/**
 * Baseline security response headers (blue-hat review). Applied to every route.
 * - `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` stop clickjacking of
 *   `/admin`. `X-Content-Type-Options: nosniff` stops MIME sniffing.
 * - `Referrer-Policy` trims referrer leakage. `Strict-Transport-Security` is
 *   emitted for prod (harmless over http in dev but only meaningful over https).
 * A full CSP with per-route nonces is deferred (the app inlines a theme script +
 * uses CSS-in-style attributes); `frame-ancestors` is the high-value directive.
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
