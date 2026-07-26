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

// ---------------------------------------------------------------------------
// Projects (admin CRUD)
//
// Mirror the SHARED CONTRACT `ProjectRow` / `ProjectDraft` shapes exposed from
// `@/server/services`. The UI `ProjectDraft` differs from the service one in two
// ways so empty form values are representable: `domain` may be `''` (nothing
// selected yet) and each graph number may be `''` (blank → "let the layout
// engine decide"). The server pages map service results into these shapes.
// ---------------------------------------------------------------------------

/** A row in the admin project table (list projection of a Project). */
export interface ProjectRow {
  id: string;
  title: string;
  slug: string;
  domain: Domain;
  featured: boolean;
  order: number;
  /** Count of Posts linked to this project (any status). Powers the delete-blocked copy. */
  relatedPostCount: number;
  updatedAt: string;
}

/** One "extra" project link (label + url), repeated in the editor. */
export interface ProjectLinkExtra {
  label: string;
  url: string;
}

/** The project links group the editor reads/writes. */
export interface ProjectLinksInput {
  repo: string;
  live: string;
  docs: string;
  extra: ProjectLinkExtra[];
}

/**
 * Graph-placement inputs. Each numeric field is `number | ''` so a blank field
 * is representable; the wire payload converts `''` → `undefined` (NOT `0`).
 */
export interface ProjectGraphInput {
  cluster: string;
  x: number | '';
  y: number | '';
  weight: number | '';
}

/** The full editable project payload the editor reads/writes. */
export interface ProjectDraft {
  id?: string;
  title: string;
  /** IMMUTABLE after creation (read-only in edit mode). */
  slug: string;
  domain: Domain | '';
  summary: string;
  role: string;
  stack: string[];
  heroText: string;
  longDescription: string;
  links: ProjectLinksInput;
  graph: ProjectGraphInput;
  order: number;
  featured: boolean;
  /** Server-DERIVED, read-only; never sent on write. */
  relatedPostSlugs: string[];
}

/** Table filter tabs: "all" plus one tab per domain. */
export type ProjectFilterKey = 'all' | Domain;
/** Project rows only support edit + delete (no publish lifecycle). */
export type ProjectRowActionKind = 'edit' | 'delete';

/** An empty draft for the "new project" editor. */
export function emptyProjectDraft(): ProjectDraft {
  return {
    title: '',
    slug: '',
    domain: '',
    summary: '',
    role: '',
    stack: [],
    heroText: '',
    longDescription: '',
    links: { repo: '', live: '', docs: '', extra: [] },
    graph: { cluster: '', x: '', y: '', weight: '' },
    order: 0,
    featured: false,
    relatedPostSlugs: [],
  };
}
