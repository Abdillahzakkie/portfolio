/**
 * Post services — public reads (published only), the admin CMS surface, and the
 * publish lifecycle. All business rules (slug uniqueness, referential integrity
 * to Project, reading-time computation, draft⇄published transitions) live HERE,
 * not in the model (data layer) or the route handlers (transport).
 *
 * Every exported function connects to the DB first.
 */

import type { FilterQuery } from 'mongoose';
import { isValidObjectId } from 'mongoose';
import { connectToDatabase } from '@/server/db/connect';
import {
  Post,
  Project,
  SLUG_REGEX,
  SLUG_MIN,
  SLUG_MAX,
  type PostStatus,
  type Domain,
  type IPost,
  type PostDocProps,
} from '@/server/models';
import type { PostListItem, PostRow, PostDraft } from './contracts';
import { ConflictError, NotFoundError, ValidationError } from './errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A structural supertype of a lean Post document (`.lean()` / `.toObject()`).
 * Deliberately loose (status as string, nullable seo fields) so the various
 * mongoose lean projections all assign to it without `unknown` gymnastics.
 */
interface LeanPost {
  _id: unknown;
  title: string;
  slug: string;
  status: string;
  publishedAt?: Date | null;
  excerpt?: string;
  body?: string;
  coverImage?: string;
  projectSlug?: string | null;
  tags?: string[];
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    ogImage?: string | null;
  } | null;
  readingTime?: number;
  updatedAt?: Date;
}

/** Estimate reading time in minutes from a Markdown body (~200 words/min, min 1). */
export function computeReadingTime(body: string): number {
  const words = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;
  return Math.max(1, Math.round(words / 200));
}

/** Normalize a possibly-empty project slug to a lowercased value or null. */
function normalizeProjectSlug(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

/** Validate the slug shape the DB will otherwise reject at write time. */
function assertValidSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (
    normalized.length < SLUG_MIN ||
    normalized.length > SLUG_MAX ||
    !SLUG_REGEX.test(normalized)
  ) {
    throw new ValidationError(
      `Invalid slug: must be ${SLUG_MIN}-${SLUG_MAX} chars, lowercase letters/numbers/hyphens.`,
    );
  }
  return normalized;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

/**
 * Batch-map lean posts to `PostListItem[]`, resolving each post's project name +
 * domain in ONE extra query (no N+1). Exported for reuse by the project service.
 */
export async function toPostListItems(posts: LeanPost[]): Promise<PostListItem[]> {
  const projectSlugs = [
    ...new Set(posts.map((p) => p.projectSlug).filter((s): s is string => Boolean(s))),
  ];

  const projects = projectSlugs.length
    ? await Project.find({ slug: { $in: projectSlugs } })
        .select('slug title domain')
        .lean()
    : [];

  const byslug = new Map<string, { name: string; domain: Domain }>();
  for (const p of projects) {
    byslug.set(p.slug, { name: p.title, domain: p.domain as Domain });
  }

  return posts.map((p) => {
    const proj = p.projectSlug ? byslug.get(p.projectSlug) : undefined;
    return {
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? '',
      domain: proj?.domain ?? null,
      tags: p.tags ?? [],
      publishedAt: toIso(p.publishedAt),
      readingTime: p.readingTime ?? 0,
      projectSlug: p.projectSlug ?? null,
      projectName: proj?.name ?? null,
    };
  });
}

/** Derive a post's domain from its linked project (single lookup). */
async function deriveDomain(projectSlug: string | null): Promise<Domain | null> {
  if (!projectSlug) return null;
  const project = await Project.findOne({ slug: projectSlug }).select('domain').lean();
  return project ? (project.domain as Domain) : null;
}

/** Map a lean/hydrated post + its derived domain into the editor's PostDraft shape. */
function toPostDraft(post: LeanPost, domain: Domain | null): PostDraft {
  return {
    id: String(post._id),
    title: post.title,
    slug: post.slug,
    projectSlug: post.projectSlug ?? null,
    domain,
    tags: post.tags ?? [],
    excerpt: post.excerpt ?? '',
    body: post.body ?? '',
    coverImage: post.coverImage ?? '',
    status: post.status as PostStatus,
    seo: {
      ...(post.seo?.metaTitle ? { metaTitle: post.seo.metaTitle } : {}),
      ...(post.seo?.metaDescription
        ? { metaDescription: post.seo.metaDescription }
        : {}),
      ...(post.seo?.ogImage ? { ogImage: post.seo.ogImage } : {}),
    },
    readingTime: post.readingTime ?? 0,
  };
}

/** Fetch a post by id, mapping to a PostDraft; null on bad/absent id. */
async function loadDraftById(id: string): Promise<PostDraft | null> {
  if (!isValidObjectId(id)) return null;
  const post = (await Post.findById(id).lean()) as LeanPost | null;
  if (!post) return null;
  const domain = await deriveDomain(post.projectSlug ?? null);
  return toPostDraft(post, domain);
}

/**
 * Rebuild a project's denormalized `relatedPostSlugs` cache from its currently
 * published posts (newest first). No-op for a null slug. Keeps the reverse-nav
 * list in sync after any post write that touches a project.
 */
async function rebuildRelatedPostSlugs(projectSlug: string | null): Promise<void> {
  if (!projectSlug) return;
  const posts = await Post.find({ projectSlug, status: 'published' })
    .sort({ publishedAt: -1 })
    .select('slug')
    .lean();
  await Project.updateOne(
    { slug: projectSlug },
    { $set: { relatedPostSlugs: posts.map((p) => p.slug) } },
  );
}

/** Verify a referenced project exists; throw a caller-actionable error if not. */
async function assertProjectExists(projectSlug: string): Promise<void> {
  const exists = await Project.countDocuments({ slug: projectSlug }).limit(1);
  if (!exists) {
    throw new ValidationError(
      `Linked project "${projectSlug}" does not exist. Pick an existing project.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Public reads (published only)
// ---------------------------------------------------------------------------

/**
 * Published posts, newest first. Optional domain filter is resolved through the
 * posts' linked projects (a post has no domain of its own — it inherits one).
 */
export async function listPublishedPosts(opts?: {
  domain?: Domain;
}): Promise<PostListItem[]> {
  await connectToDatabase();

  const query: FilterQuery<PostDocProps> = { status: 'published' };

  if (opts?.domain) {
    const projects = await Project.find({ domain: opts.domain }).select('slug').lean();
    const slugs = projects.map((p) => p.slug);
    if (slugs.length === 0) return [];
    query.projectSlug = { $in: slugs };
  }

  const posts = (await Post.find(query)
    .sort({ publishedAt: -1 })
    .lean()) as LeanPost[];

  return toPostListItems(posts);
}

/**
 * One published post by slug, plus its project banner and prev/next nav.
 * Returns null for a missing slug OR a draft (frontend then renders a 404 —
 * ACCEPTANCE #3: drafts must not be readable by anonymous users).
 */
export async function getPublishedPost(slug: string): Promise<{
  post: IPost;
  project: { slug: string; name: string; tagline: string } | null;
  prevSlug: string | null;
  nextSlug: string | null;
} | null> {
  await connectToDatabase();

  const post = (await Post.findOne({
    slug: slug.toLowerCase().trim(),
    status: 'published',
  }).lean()) as LeanPost | null;

  if (!post) return null;

  let project: { slug: string; name: string; tagline: string } | null = null;
  if (post.projectSlug) {
    const proj = await Project.findOne({ slug: post.projectSlug })
      .select('slug title summary heroText')
      .lean();
    if (proj) {
      project = {
        slug: proj.slug,
        name: proj.title,
        tagline: (proj.summary && proj.summary.trim()) || (proj.heroText ?? ''),
      };
    }
  }

  // Prev/next within the published timeline (desc: newest first).
  const ordered = await Post.find({ status: 'published' })
    .sort({ publishedAt: -1 })
    .select('slug')
    .lean();
  const idx = ordered.findIndex((p) => p.slug === post.slug);
  const prevSlug = idx > 0 ? ordered[idx - 1].slug : null;
  const nextSlug =
    idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].slug : null;

  const iPost = JSON.parse(
    JSON.stringify({ ...post, _id: String(post._id) }),
  ) as IPost;

  return { post: iPost, project, prevSlug, nextSlug };
}

// ---------------------------------------------------------------------------
// Admin CMS (callers must already be authenticated — see auth layer + middleware)
// ---------------------------------------------------------------------------

/** Admin post list (all statuses). `filter` narrows to published/drafts. */
export async function listPostsForAdmin(
  filter: 'all' | 'published' | 'drafts',
): Promise<PostRow[]> {
  await connectToDatabase();

  const query: FilterQuery<PostDocProps> = {};
  if (filter === 'published') query.status = 'published';
  else if (filter === 'drafts') query.status = 'draft';

  const posts = (await Post.find(query)
    .sort({ updatedAt: -1 })
    .lean()) as LeanPost[];

  const projectSlugs = [
    ...new Set(posts.map((p) => p.projectSlug).filter((s): s is string => Boolean(s))),
  ];
  const projects = projectSlugs.length
    ? await Project.find({ slug: { $in: projectSlugs } }).select('slug title').lean()
    : [];
  const nameBySlug = new Map(projects.map((p) => [p.slug, p.title]));

  return posts.map((p) => ({
    id: String(p._id),
    title: p.title,
    slug: p.slug,
    projectSlug: p.projectSlug ?? null,
    projectName: p.projectSlug ? (nameBySlug.get(p.projectSlug) ?? null) : null,
    status: p.status as PostStatus,
    updatedAt: toIso(p.updatedAt) ?? new Date(0).toISOString(),
    publishedAt: toIso(p.publishedAt),
  }));
}

/** Load a post into the editor by id (any status). Null on bad/absent id. */
export async function getPostForEditor(id: string): Promise<PostDraft | null> {
  await connectToDatabase();
  return loadDraftById(id);
}

/** Is this slug free? `exceptId` excludes the post being edited from the check. */
export async function isSlugAvailable(
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  await connectToDatabase();
  const normalized = slug.trim().toLowerCase();
  const existing = await Post.findOne({ slug: normalized }).select('_id').lean();
  if (!existing) return true;
  if (exceptId && String(existing._id) === exceptId) return true;
  return false;
}

/**
 * Create a post. New posts are ALWAYS drafts (publishing is a dedicated,
 * auditable action) — the incoming `status` is ignored here. Validates slug
 * shape + uniqueness and, if linked, that the project exists.
 */
export async function createPost(draft: PostDraft): Promise<PostDraft> {
  await connectToDatabase();

  const title = draft.title?.trim();
  if (!title) throw new ValidationError('Title is required.');

  const slug = assertValidSlug(draft.slug ?? '');
  if (!(await isSlugAvailable(slug))) {
    throw new ConflictError(`Slug "${slug}" is already taken.`);
  }

  const projectSlug = normalizeProjectSlug(draft.projectSlug);
  if (projectSlug) await assertProjectExists(projectSlug);

  const created = await Post.create({
    title,
    slug,
    status: 'draft',
    publishedAt: null,
    excerpt: draft.excerpt ?? '',
    body: draft.body ?? '',
    coverImage: draft.coverImage ?? '',
    projectSlug,
    tags: draft.tags ?? [],
    seo: draft.seo ?? {},
    readingTime: computeReadingTime(draft.body ?? ''),
  });

  await rebuildRelatedPostSlugs(projectSlug);

  const domain = await deriveDomain(projectSlug);
  return toPostDraft(created.toObject() as LeanPost, domain);
}

/**
 * Update a post's content. Does NOT change publish state — status + publishedAt
 * are owned by publish/unpublish so lifecycle changes stay auditable. Re-validates
 * slug + project reference and recomputes reading time.
 */
export async function updatePost(id: string, draft: PostDraft): Promise<PostDraft> {
  await connectToDatabase();
  if (!isValidObjectId(id)) throw new NotFoundError('Post not found.');

  const post = await Post.findById(id);
  if (!post) throw new NotFoundError('Post not found.');

  const title = draft.title?.trim();
  if (!title) throw new ValidationError('Title is required.');

  const slug = assertValidSlug(draft.slug ?? '');
  if (!(await isSlugAvailable(slug, id))) {
    throw new ConflictError(`Slug "${slug}" is already taken.`);
  }

  const newProjectSlug = normalizeProjectSlug(draft.projectSlug);
  if (newProjectSlug) await assertProjectExists(newProjectSlug);
  const oldProjectSlug = post.projectSlug ?? null;

  post.title = title;
  post.slug = slug;
  post.excerpt = draft.excerpt ?? '';
  post.body = draft.body ?? '';
  post.coverImage = draft.coverImage ?? '';
  post.projectSlug = newProjectSlug;
  post.tags = draft.tags ?? [];
  post.seo = draft.seo ?? {};
  post.readingTime = computeReadingTime(draft.body ?? '');
  await post.save();

  // Keep both the old and new project's reverse-nav caches correct.
  if (oldProjectSlug !== newProjectSlug) {
    await rebuildRelatedPostSlugs(oldProjectSlug);
  }
  await rebuildRelatedPostSlugs(newProjectSlug);

  const domain = await deriveDomain(newProjectSlug);
  return toPostDraft(post.toObject() as LeanPost, domain);
}

/**
 * Publish a post: flip to `published` and stamp `publishedAt` IFF it was null
 * (never overwrite the original publish date on re-publish). Requires the
 * publish-gate fields (title, slug, project link, body) to be present.
 */
export async function publishPost(id: string): Promise<PostDraft> {
  await connectToDatabase();
  if (!isValidObjectId(id)) throw new NotFoundError('Post not found.');

  const post = await Post.findById(id);
  if (!post) throw new NotFoundError('Post not found.');

  const missing: string[] = [];
  if (!post.title?.trim()) missing.push('title');
  if (!post.slug?.trim()) missing.push('slug');
  if (!post.projectSlug?.trim()) missing.push('project link');
  if (!post.body?.trim()) missing.push('body');
  if (missing.length) {
    throw new ValidationError(
      `Cannot publish — missing required field(s): ${missing.join(', ')}.`,
    );
  }

  // Referential integrity is enforced at publish time too (project may have gone).
  await assertProjectExists(post.projectSlug as string);

  post.status = 'published';
  if (!post.publishedAt) post.publishedAt = new Date();
  await post.save();

  await rebuildRelatedPostSlugs(post.projectSlug ?? null);

  const domain = await deriveDomain(post.projectSlug ?? null);
  return toPostDraft(post.toObject() as LeanPost, domain);
}

/**
 * Unpublish: revert to `draft` (pulls it from public reads + sitemap). The
 * original `publishedAt` is retained so a later re-publish keeps the first date.
 */
export async function unpublishPost(id: string): Promise<PostDraft> {
  await connectToDatabase();
  if (!isValidObjectId(id)) throw new NotFoundError('Post not found.');

  const post = await Post.findById(id);
  if (!post) throw new NotFoundError('Post not found.');

  post.status = 'draft';
  await post.save();

  await rebuildRelatedPostSlugs(post.projectSlug ?? null);

  const domain = await deriveDomain(post.projectSlug ?? null);
  return toPostDraft(post.toObject() as LeanPost, domain);
}

/** Delete a post and refresh the linked project's reverse-nav cache. */
export async function deletePost(id: string): Promise<void> {
  await connectToDatabase();
  if (!isValidObjectId(id)) throw new NotFoundError('Post not found.');

  const post = await Post.findById(id).select('projectSlug');
  if (!post) throw new NotFoundError('Post not found.');
  const projectSlug = post.projectSlug ?? null;

  await Post.deleteOne({ _id: id });
  await rebuildRelatedPostSlugs(projectSlug);
}
