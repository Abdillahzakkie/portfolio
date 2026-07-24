/**
 * Cache-revalidation helpers for the publish lifecycle.
 *
 * `/`, `/blog`, `/sitemap.xml`, and `/rss.xml` are statically prerendered, so a
 * CMS publish/unpublish is invisible until the next rebuild unless we explicitly
 * revalidate their paths. `revalidatePath` is valid inside a route handler (it
 * runs in a request scope). Called from the publish + unpublish route handlers
 * AFTER a successful status transition.
 */

import { revalidatePath } from 'next/cache';

/** Public surfaces that list/aggregate published posts (all statically cached). */
const PUBLIC_INDEX_PATHS = ['/', '/blog', '/sitemap.xml', '/rss.xml'] as const;

/**
 * Revalidate every public surface affected by a post's publish/unpublish:
 * the shared index/aggregate pages, the post's own detail page, and (if the post
 * is linked to a project) that project's case-study page whose related-posts list
 * changed.
 */
export function revalidatePublicPost(
  slug: string,
  projectSlug: string | null,
): void {
  for (const path of PUBLIC_INDEX_PATHS) {
    revalidatePath(path);
  }
  if (slug) revalidatePath(`/blog/${slug}`);
  if (projectSlug) revalidatePath(`/projects/${projectSlug}`);
}
