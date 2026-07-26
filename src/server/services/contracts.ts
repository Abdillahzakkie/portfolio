/**
 * SHARED CONTRACT v1 — derived (view/DTO) types.
 *
 * These are the exact shapes the frontend (public + admin) and the qa suite build
 * against. They are NOT the raw DB documents (see `@/server/models` for those) —
 * they are the projections the service layer returns. Keeping them here, runtime-
 * free, means a client bundle can `import type` them without pulling mongoose.
 *
 * Re-exported from the `@/server/services` barrel.
 */

import type { Domain, PostStatus, IProject } from '@/server/models';

/**
 * One project as a node on the domain-graph home (and the source for cards,
 * the case-study header, and the node popover).
 *
 * - `prominence` = clamp(round(project.graph.weight ?? 1), 1, 3) — node size tier.
 * - `tagline` = project.summary || project.heroText.
 * - `hasPublishedPost` = at least one published Post links to this project.
 * - `links.postSlug` = slug of the NEWEST published post backing this project.
 */
export interface ProjectNodeData {
  slug: string;
  name: string;
  domain: Domain;
  prominence: 1 | 2 | 3;
  tagline: string;
  stack: string[];
  hasPublishedPost: boolean;
  links: { repo?: string; live?: string; postSlug?: string };
}

/** A published post as it appears in a list/card (blog index, related write-ups). */
export interface PostListItem {
  slug: string;
  title: string;
  excerpt: string;
  /** Derived from the linked project's domain; null for a standalone essay. */
  domain: Domain | null;
  tags: string[];
  publishedAt: string | null;
  readingTime: number;
  projectSlug: string | null;
  projectName: string | null;
}

/** One row in the admin post table. */
export interface PostRow {
  id: string;
  title: string;
  slug: string;
  projectSlug: string | null;
  projectName: string | null;
  status: PostStatus;
  updatedAt: string;
  publishedAt: string | null;
}

/**
 * The full editable post payload used by the admin editor (load + save).
 *
 * `domain` is DERIVED from the linked project (`projectSlug`) — the Post model
 * has no domain column, a post inherits its project's domain. It is returned for
 * the editor's convenience and IGNORED on write (single source of truth = the
 * project). `id` is absent when creating.
 */
export interface PostDraft {
  id?: string;
  title: string;
  slug: string;
  projectSlug: string | null;
  domain: Domain | null;
  tags: string[];
  excerpt: string;
  body: string;
  coverImage: string;
  status: PostStatus;
  seo: { metaTitle?: string; metaDescription?: string; ogImage?: string };
  readingTime?: number;
}

/** One row in the admin project table. */
export interface ProjectRow {
  id: string;
  title: string;
  slug: string;
  domain: Domain;
  featured: boolean;
  order: number;
  /** Count of Posts linked to this project (any status), batched — no N+1. */
  relatedPostCount: number;
  updatedAt: string;
}

/**
 * The full editable project payload used by the admin editor (load + save).
 *
 * `id` is absent when creating. `slug` is IMMUTABLE after creation — the update
 * service ignores any incoming slug. `relatedPostSlugs` is server-DERIVED and
 * read-only (ignored on write; the reverse-nav cache is owned by the post layer).
 */
export interface ProjectDraft {
  id?: string;
  title: string;
  slug: string;
  domain: Domain;
  summary: string;
  role: string;
  stack: string[];
  heroText: string;
  longDescription: string;
  links: {
    repo?: string;
    live?: string;
    docs?: string;
    extra?: { label: string; url: string }[];
  };
  graph: { cluster?: string; x?: number; y?: number; weight?: number };
  order: number;
  featured: boolean;
  /** Server-DERIVED, read-only; ignored on write. */
  relatedPostSlugs: string[];
}

/** Everything the public case-study page needs for one project. */
export interface ProjectView {
  project: IProject;
  relatedPosts: PostListItem[];
  /** Kinship links — sibling projects in the same domain cluster. */
  related: { slug: string; name: string }[];
}

/** A single item in the RSS feed (published posts only). */
export interface RssItem {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string | null;
}

/** Sitemap source data (published content only — drafts excluded, ACCEPTANCE #3). */
export interface SitemapData {
  projects: { slug: string; updatedAt: string }[];
  posts: { slug: string; publishedAt: string | null; updatedAt: string }[];
}
