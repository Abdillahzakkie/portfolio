/**
 * robots.txt (Next `MetadataRoute.Robots`).
 *
 * Allows the public site, disallows the admin surface + the API (neither should
 * be crawled), and points crawlers at the sitemap.
 */

import type { MetadataRoute } from 'next';

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
