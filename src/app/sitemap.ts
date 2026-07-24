/**
 * sitemap.xml (Next `MetadataRoute.Sitemap`).
 *
 * Lists the static public routes, every FEATURED project, and every PUBLISHED
 * post. Drafts are excluded (ACCEPTANCE #3) — the sitemap query filters to
 * `status:'published'`, so a draft never appears here and, per the reader page's
 * own 404 for drafts, is unreachable to anonymous users.
 */

import type { MetadataRoute } from 'next';
import { getSitemapData } from '@/server/services';

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { projects, posts } = await getSitemapData();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const projectRoutes: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${SITE_URL}/projects/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.updatedAt || p.publishedAt || now),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...projectRoutes, ...postRoutes];
}
