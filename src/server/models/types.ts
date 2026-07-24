/**
 * Shared data-contract types for the portfolio + blog CMS.
 *
 * This file imports NOTHING at runtime (no mongoose) so it is safe to import
 * from the client bundle, the admin bundle, the API layer, and services alike.
 * The Mongoose schemas in the sibling model files are typed against these
 * interfaces, so the DB shape and the wire/type shape can never drift.
 *
 * Backend and frontend should import from `@/server/models` (the barrel) which
 * re-exports everything here.
 */

// ---------------------------------------------------------------------------
// Enums (expressed as const arrays + derived union types so both a runtime
// value list — for Zod/validation/UI dropdowns — and a compile-time type exist)
// ---------------------------------------------------------------------------

/** The four portfolio clusters that the domain-graph home groups projects by. */
export const DOMAINS = ['web3', 'security', 'commerce', 'tools-labs'] as const;
export type Domain = (typeof DOMAINS)[number];

/** Human-friendly labels for each domain (for headings / graph cluster titles). */
export const DOMAIN_LABELS: Record<Domain, string> = {
  web3: 'Web3',
  security: 'Security',
  commerce: 'Commerce',
  'tools-labs': 'Tools / Labs',
};

/** Binary publish lifecycle. New posts default to `draft`. */
export const POST_STATUSES = ['draft', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** Admin/auth roles. `admin` is the only privileged role today; `editor` is
 *  reserved for a future least-privilege authoring account. */
export const USER_ROLES = ['admin', 'editor'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Shared regex/length rules for slugs. Enforced in the schema AND re-exported
 *  so services/UI can validate before hitting the DB (DB is the last guard). */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 100;

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

/** A single external link on a project beyond the well-known repo/live/docs. */
export interface ProjectLink {
  label: string;
  url: string;
}

/** Well-known links plus an escape hatch for arbitrary labelled links. */
export interface ProjectLinks {
  repo?: string;
  live?: string;
  docs?: string;
  /** Anything else: npm, demo video, case-study PDF, etc. */
  extra?: ProjectLink[];
}

/**
 * Positioning/sizing hints for the interactive domain-graph home.
 * `cluster` is the visual grouping key (usually mirrors `domain`, but kept
 * separate so a sub-cluster can be introduced without touching the enum).
 * `x`/`y` are optional hand-authored coordinates (0..1 normalized); when
 * absent the layout engine computes them. `weight` scales node size.
 */
export interface ProjectGraphMeta {
  cluster: string;
  x?: number;
  y?: number;
  weight?: number;
}

/** Plain data shape of a Project as returned by the API / rendered by the UI. */
export interface IProject {
  /** String form of the Mongo `_id`. */
  _id: string;
  title: string;
  /** Canonical URL key, unique, lowercase. */
  slug: string;
  domain: Domain;
  summary: string;
  role: string;
  stack: string[];
  links: ProjectLinks;
  heroText: string;
  /** Long-form case-study body. Markdown/MDX string (see DATA-MODEL.md). */
  longDescription: string;
  graph: ProjectGraphMeta;
  /** Slugs of Posts that dive deeper into this project (denormalized nav aid). */
  relatedPostSlugs: string[];
  /** Sort order within a domain cluster (ascending). */
  order: number;
  /** Whether the project appears on the graph home. */
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Fields a seed/create payload must supply for a Project (server fills the rest). */
export type ProjectSeedInput = Pick<
  IProject,
  'title' | 'slug' | 'domain' | 'summary'
> &
  Partial<
    Pick<
      IProject,
      | 'role'
      | 'stack'
      | 'links'
      | 'heroText'
      | 'longDescription'
      | 'graph'
      | 'relatedPostSlugs'
      | 'order'
      | 'featured'
    >
  >;

// ---------------------------------------------------------------------------
// Post
// ---------------------------------------------------------------------------

/** SEO override fields. When empty the UI derives sane defaults from title/excerpt. */
export interface PostSeo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
}

/** Plain data shape of a blog Post as returned by the API / rendered by the UI. */
export interface IPost {
  _id: string;
  title: string;
  /** Canonical URL key, unique, lowercase. */
  slug: string;
  status: PostStatus;
  /** Set when first published; null while draft. Drives sitemap + ordering. */
  publishedAt: string | null;
  excerpt: string;
  /** Rich body stored as Markdown/MDX (see DATA-MODEL.md for the rationale). */
  body: string;
  coverImage: string;
  /** FK → Project.slug. The project this post backs (ACCEPTANCE #3). Nullable
   *  so a standalone essay can exist without a project. */
  projectSlug: string | null;
  tags: string[];
  seo: PostSeo;
  /** Estimated reading time in minutes (derived from body on save). */
  readingTime: number;
  createdAt: string;
  updatedAt: string;
}

/** Fields a seed/create payload must supply for a Post (server fills the rest). */
export type PostSeedInput = Pick<IPost, 'title' | 'slug' | 'body'> &
  Partial<
    Pick<
      IPost,
      | 'status'
      | 'publishedAt'
      | 'excerpt'
      | 'coverImage'
      | 'projectSlug'
      | 'tags'
      | 'seo'
      | 'readingTime'
    >
  >;

// ---------------------------------------------------------------------------
// User (admin)
// ---------------------------------------------------------------------------

/**
 * Admin user. `passwordHash` is written by the backend auth layer (never a
 * plaintext password) and is `select:false` in the schema, so it is omitted
 * from normal reads. It is typed optional here for that reason.
 */
export interface IUser {
  _id: string;
  email: string;
  /** bcrypt/argon2 hash — server-only, never sent to any client. */
  passwordHash?: string;
  role: UserRole;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

/** A User safe to expose to a client (hash stripped). */
export type PublicUser = Omit<IUser, 'passwordHash'>;
