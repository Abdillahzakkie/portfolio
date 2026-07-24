/**
 * SEO feed services — the single source of truth for what appears in
 * `sitemap.xml` and `rss.xml`. Published content ONLY: drafts must never leak
 * into either feed (ACCEPTANCE #3).
 */

import { connectToDatabase } from '@/server/db/connect';
import { Post } from '@/server/models';
import type { RssItem, SitemapData } from './contracts';
import { listFeaturedProjectRefs } from './projects';

/** Published projects + posts for the sitemap (drafts excluded). */
export async function getSitemapData(): Promise<SitemapData> {
  await connectToDatabase();

  const [projects, posts] = await Promise.all([
    listFeaturedProjectRefs(),
    Post.find({ status: 'published' })
      .sort({ publishedAt: -1 })
      .select('slug publishedAt updatedAt')
      .lean(),
  ]);

  return {
    projects,
    posts: posts.map((p) => ({
      slug: p.slug,
      publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
      updatedAt: new Date(p.updatedAt as unknown as Date).toISOString(),
    })),
  };
}

/** Published posts for the RSS feed, newest first. */
export async function getRssItems(): Promise<RssItem[]> {
  await connectToDatabase();

  const posts = await Post.find({ status: 'published' })
    .sort({ publishedAt: -1 })
    .select('slug title excerpt publishedAt')
    .lean();

  return posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? '',
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
  }));
}
