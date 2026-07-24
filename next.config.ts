import type { NextConfig } from 'next';

/**
 * Next.js config — deliberately minimal.
 *
 * - `output: 'standalone'` produces a self-contained server bundle for the
 *   optional Dockerfile. Vercel ignores this and uses its own build output, so
 *   the same config deploys to both targets unchanged.
 * - `reactStrictMode` surfaces effect/lifecycle bugs in dev.
 * - No remote image domains are configured on purpose: the design uses no
 *   external images by default (see docs/design). Add entries to
 *   `images.remotePatterns` only when a real remote host is introduced.
 * - The Markdown render stack (react-markdown + remark/rehype) is pure runtime
 *   code and needs no build/webpack configuration here.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
};

export default nextConfig;
