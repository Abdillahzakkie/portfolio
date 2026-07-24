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
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
