/**
 * UI-facing data-contract types for the admin slice.
 *
 * These mirror the SHARED CONTRACT v1 shapes the backend exposes from
 * `@/server/services` (PostRow / PostDraft). They are declared locally so the
 * admin components typecheck independently while the backend service layer is
 * built in parallel; at integration the server pages map service results into
 * these shapes (field names are identical). `PostStatus` / `Domain` are pulled
 * from `@/server/models`, which already exists and is runtime-free for types.
 */
import type { PostStatus, Domain } from '@/server/models';

export type { PostStatus, Domain };

/** A row in the admin post table (list projection of a Post). */
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

/** SEO override block, mirrors `PostSeo`. */
export interface PostSeoInput {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
}

/** The full editable post payload the editor reads/writes. */
export interface PostDraft {
  id?: string;
  title: string;
  slug: string;
  projectSlug: string | null;
  /** UI-only convenience: derived from the linked project's domain. */
  domain: Domain | '';
  tags: string[];
  excerpt: string;
  body: string;
  coverImage: string;
  status: PostStatus;
  seo: PostSeoInput;
  readingTime?: number;
}

/** Option for the "link to project" select (from `listProjectOptions`). */
export interface ProjectOption {
  slug: string;
  name: string;
  domain?: Domain;
}

export type FilterKey = 'all' | 'published' | 'drafts';
export type RowActionKind = 'edit' | 'publish' | 'unpublish' | 'delete';

/** An empty draft for the "new post" editor. */
export function emptyDraft(): PostDraft {
  return {
    title: '',
    slug: '',
    projectSlug: null,
    domain: '',
    tags: [],
    excerpt: '',
    body: '',
    coverImage: '',
    status: 'draft',
    seo: {},
  };
}
