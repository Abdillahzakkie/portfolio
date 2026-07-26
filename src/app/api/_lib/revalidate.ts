/**
 * Cache-revalidation helpers for the publish lifecycle.
 *
 * `/`, `/blog`, `/sitemap.xml`, and `/rss.xml` are statically prerendered, so a
 * CMS publish/unpublish is invisible until the next rebuild unless we explicitly
 * revalidate their paths. `revalidatePath` is valid inside a route handler (it
 * runs in a request scope). Called from the publish + unpublish route handlers
 * AFTER a successful status transition.
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { SITE_SETTINGS_TAG } from '@/server/services';

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

/**
 * Revalidate the public surfaces a project edit changes: the graph home (`/`,
 * where featured projects render as nodes) and the project's own case-study page.
 * Called from the project create/update/delete route handlers after a successful
 * write.
 */
export function revalidatePublicProject(slug: string): void {
  revalidatePath('/');
  if (slug) revalidatePath(`/projects/${slug}`);
}

/**
 * Revalidate everything that reads site settings: the cache tag the settings
 * service stores its read under (so the cross-request cached value refreshes),
 * plus EVERY statically-prerendered public page. `siteName` renders in the root
 * layout (footer + title) on every route (`/projects/[slug]`, `/blog/[slug]`,
 * …), so revalidating only `/`, `/about`, `/blog` left the rest stale.
 * `revalidatePath('/', 'layout')` revalidates every route nested under the root
 * layout, covering them all. Called after a successful settings write.
 */
export function revalidateSiteSettings(): void {
  revalidateTag(SITE_SETTINGS_TAG);
  revalidatePath('/', 'layout');
}
