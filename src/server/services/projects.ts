/**
 * Project services — the domain-graph home, the case-study page, and the admin
 * editor's project picker. Read-only; projects are authored via seed/content,
 * not the CMS.
 *
 * Every exported function connects to the DB first (idempotent, cached).
 */

import { isValidObjectId } from 'mongoose';
import { connectToDatabase } from '@/server/db/connect';
import {
  Project,
  Post,
  DOMAINS,
  SLUG_REGEX,
  SLUG_MIN,
  SLUG_MAX,
  type IProject,
  type Domain,
} from '@/server/models';
import type {
  ProjectNodeData,
  ProjectView,
  ProjectRow,
  ProjectDraft,
} from './contracts';
import { toPostListItems } from './posts';
import { ConflictError, NotFoundError, ValidationError } from './errors';

/** Clamp a numeric graph weight to the 1..3 prominence tiers the UI renders. */
function toProminence(weight: number | null | undefined): 1 | 2 | 3 {
  const rounded = Math.round(weight ?? 1);
  if (rounded <= 1) return 1;
  if (rounded >= 3) return 3;
  return 2;
}

/** project.summary is the primary tagline; fall back to the hero hook. */
function toTagline(summary: string, heroText: string): string {
  return (summary && summary.trim()) || (heroText ?? '');
}

/**
 * Serialize a lean Project doc's `graph` object safely. Mongoose lean() types the
 * sub-doc loosely, so we narrow the one field we need.
 */
function graphWeight(graph: unknown): number | undefined {
  if (graph && typeof graph === 'object' && 'weight' in graph) {
    const w = (graph as { weight?: unknown }).weight;
    return typeof w === 'number' ? w : undefined;
  }
  return undefined;
}

/**
 * The graph-home payload: every featured project as a node, ordered by
 * (domain, order). `hasPublishedPost` / `links.postSlug` are derived from the
 * Post collection in a single batched query (no N+1).
 */
export async function getConstellation(): Promise<{ nodes: ProjectNodeData[] }> {
  await connectToDatabase();

  const projects = await Project.find({ featured: true })
    .sort({ domain: 1, order: 1 })
    .lean();

  const slugs = projects.map((p) => p.slug);

  // Newest published post per project (sorted desc → first seen per slug is newest).
  const posts = slugs.length
    ? await Post.find({ status: 'published', projectSlug: { $in: slugs } })
        .sort({ publishedAt: -1 })
        .select('slug projectSlug publishedAt')
        .lean()
    : [];

  const newestPostBySlug = new Map<string, string>();
  for (const post of posts) {
    if (post.projectSlug && !newestPostBySlug.has(post.projectSlug)) {
      newestPostBySlug.set(post.projectSlug, post.slug);
    }
  }

  const nodes: ProjectNodeData[] = projects.map((p) => {
    const postSlug = newestPostBySlug.get(p.slug);
    return {
      slug: p.slug,
      name: p.title,
      domain: p.domain as Domain,
      prominence: toProminence(graphWeight(p.graph)),
      tagline: toTagline(p.summary ?? '', p.heroText ?? ''),
      stack: p.stack ?? [],
      hasPublishedPost: Boolean(postSlug),
      links: {
        ...(p.links?.repo ? { repo: p.links.repo } : {}),
        ...(p.links?.live ? { live: p.links.live } : {}),
        ...(postSlug ? { postSlug } : {}),
      },
    };
  });

  return { nodes };
}

/** Serialize a lean Project doc into the plain `IProject` wire shape. */
function toIProject(doc: Record<string, unknown>): IProject {
  return JSON.parse(JSON.stringify({ ...doc, _id: String(doc._id) })) as IProject;
}

/**
 * Everything the public case-study page needs. Returns null when no project has
 * the slug (frontend renders the shared NotFound → 404).
 */
export async function getProjectView(slug: string): Promise<ProjectView | null> {
  await connectToDatabase();

  const project = await Project.findOne({ slug: slug.toLowerCase().trim() }).lean();
  if (!project) return null;

  const publishedPosts = await Post.find({
    projectSlug: project.slug,
    status: 'published',
  })
    .sort({ publishedAt: -1 })
    .lean();

  const relatedPosts = await toPostListItems(publishedPosts);

  // Kinship: sibling projects in the same domain cluster, author order, self excluded.
  const siblings = await Project.find({
    domain: project.domain,
    slug: { $ne: project.slug },
  })
    .sort({ order: 1 })
    .select('slug title')
    .limit(6)
    .lean();

  return {
    project: toIProject(project),
    relatedPosts,
    related: siblings.map((s) => ({ slug: s.slug, name: s.title })),
  };
}

/**
 * Slug + name of every project, for the editor's "link to a project" select.
 * Admin-only helper (the referenced project need not be featured/public).
 */
export async function listProjectOptions(): Promise<{ slug: string; name: string }[]> {
  await connectToDatabase();
  const projects = await Project.find({})
    .sort({ domain: 1, order: 1 })
    .select('slug title')
    .lean();
  return projects.map((p) => ({ slug: p.slug, name: p.title }));
}

/** Does a project with this slug exist? Referential-integrity guard for posts. */
export async function projectExists(slug: string): Promise<boolean> {
  await connectToDatabase();
  const count = await Project.countDocuments({ slug: slug.toLowerCase().trim() }).limit(1);
  return count > 0;
}

/** Featured-project references for the sitemap (slug + lastModified). */
export async function listFeaturedProjectRefs(): Promise<
  { slug: string; updatedAt: string }[]
> {
  await connectToDatabase();
  const projects = await Project.find({ featured: true })
    .sort({ domain: 1, order: 1 })
    .select('slug updatedAt')
    .lean();
  return projects.map((p) => ({
    slug: p.slug,
    updatedAt: new Date(p.updatedAt as unknown as Date).toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Admin CRUD (callers must already be authenticated — see auth layer + guard).
// Projects are now authored through the admin CMS, not just seed/content.
// ---------------------------------------------------------------------------

/** A structural supertype of a lean Project document (loose so lean projections assign). */
interface LeanProject {
  _id: unknown;
  title: string;
  slug: string;
  domain: string;
  summary?: string;
  role?: string;
  stack?: string[];
  heroText?: string;
  longDescription?: string;
  links?: {
    repo?: string;
    live?: string;
    docs?: string;
    extra?: { label: string; url: string }[];
  } | null;
  graph?: {
    cluster?: string;
    x?: number;
    y?: number;
    weight?: number;
  } | null;
  relatedPostSlugs?: string[];
  order?: number;
  featured?: boolean;
  updatedAt?: Date;
}

function toIso(value: Date | null | undefined): string {
  return value ? new Date(value).toISOString() : new Date(0).toISOString();
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

/** Assert an incoming domain is one of the known clusters. */
function assertValidDomain(domain: string): Domain {
  if (!(DOMAINS as readonly string[]).includes(domain)) {
    throw new ValidationError(
      `Invalid domain "${domain}". Must be one of: ${DOMAINS.join(', ')}.`,
    );
  }
  return domain as Domain;
}

/** Build the sanitized links sub-object for persistence (drops empties). */
function toPersistLinks(links: ProjectDraft['links']): IProject['links'] {
  const out: IProject['links'] = {};
  if (links?.repo?.trim()) out.repo = links.repo.trim();
  if (links?.live?.trim()) out.live = links.live.trim();
  if (links?.docs?.trim()) out.docs = links.docs.trim();
  const extra = (links?.extra ?? [])
    .filter((l) => l && l.label?.trim() && l.url?.trim())
    .map((l) => ({ label: l.label.trim(), url: l.url.trim() }));
  if (extra.length) out.extra = extra;
  return out;
}

/** Build the sanitized graph sub-object for persistence. */
function toPersistGraph(graph: ProjectDraft['graph']): IProject['graph'] {
  const out: IProject['graph'] = { cluster: graph?.cluster?.trim() ?? '' };
  if (typeof graph?.x === 'number') out.x = graph.x;
  if (typeof graph?.y === 'number') out.y = graph.y;
  if (typeof graph?.weight === 'number') out.weight = graph.weight;
  return out;
}

/** Map a lean Project doc into the editor's ProjectDraft shape. */
function toProjectDraft(p: LeanProject): ProjectDraft {
  const links: ProjectDraft['links'] = {};
  if (p.links?.repo) links.repo = p.links.repo;
  if (p.links?.live) links.live = p.links.live;
  if (p.links?.docs) links.docs = p.links.docs;
  if (p.links?.extra?.length) {
    links.extra = p.links.extra.map((l) => ({ label: l.label, url: l.url }));
  }

  const graph: ProjectDraft['graph'] = {};
  if (p.graph?.cluster) graph.cluster = p.graph.cluster;
  if (typeof p.graph?.x === 'number') graph.x = p.graph.x;
  if (typeof p.graph?.y === 'number') graph.y = p.graph.y;
  if (typeof p.graph?.weight === 'number') graph.weight = p.graph.weight;

  return {
    id: String(p._id),
    title: p.title,
    slug: p.slug,
    domain: p.domain as Domain,
    summary: p.summary ?? '',
    role: p.role ?? '',
    stack: p.stack ?? [],
    heroText: p.heroText ?? '',
    longDescription: p.longDescription ?? '',
    links,
    graph,
    order: p.order ?? 0,
    featured: Boolean(p.featured),
    relatedPostSlugs: p.relatedPostSlugs ?? [],
  };
}

/**
 * Admin project list (all projects), ordered (domain, order). `relatedPostCount`
 * = number of Posts (any status) linked to each project, resolved in ONE
 * aggregation over the Post collection (no N+1).
 */
export async function listProjectsForAdmin(): Promise<ProjectRow[]> {
  await connectToDatabase();

  const projects = (await Project.find({})
    .sort({ domain: 1, order: 1 })
    .lean()) as LeanProject[];

  const slugs = projects.map((p) => p.slug);
  const counts = slugs.length
    ? await Post.aggregate<{ _id: string; count: number }>([
        { $match: { projectSlug: { $in: slugs } } },
        { $group: { _id: '$projectSlug', count: { $sum: 1 } } },
      ])
    : [];
  const countBySlug = new Map(counts.map((c) => [c._id, c.count]));

  return projects.map((p) => ({
    id: String(p._id),
    title: p.title,
    slug: p.slug,
    domain: p.domain as Domain,
    featured: Boolean(p.featured),
    order: p.order ?? 0,
    relatedPostCount: countBySlug.get(p.slug) ?? 0,
    updatedAt: toIso(p.updatedAt),
  }));
}

/** Load a project into the editor by id. Null on bad/absent id. */
export async function getProjectForEditor(id: string): Promise<ProjectDraft | null> {
  await connectToDatabase();
  if (!isValidObjectId(id)) return null;
  const project = (await Project.findById(id).lean()) as LeanProject | null;
  if (!project) return null;
  return toProjectDraft(project);
}

/** Is this project slug free? `exceptId` excludes the project being edited. */
export async function isProjectSlugAvailable(
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  await connectToDatabase();
  const normalized = slug.trim().toLowerCase();
  const existing = await Project.findOne({ slug: normalized }).select('_id').lean();
  if (!existing) return true;
  if (exceptId && String(existing._id) === exceptId) return true;
  return false;
}

/**
 * Create a project. Validates title + summary presence, slug shape + uniqueness
 * (ConflictError on dup), and domain membership. `relatedPostSlugs` is NOT set
 * here — it is a derived cache owned by the post layer. Returns id + slug.
 */
export async function createProject(
  draft: ProjectDraft,
): Promise<{ id: string; slug: string }> {
  await connectToDatabase();

  const title = draft.title?.trim();
  if (!title) throw new ValidationError('Title is required.');

  const summary = draft.summary?.trim();
  if (!summary) throw new ValidationError('Summary is required.');

  const domain = assertValidDomain(draft.domain);

  const slug = assertValidSlug(draft.slug ?? '');
  if (!(await isProjectSlugAvailable(slug))) {
    throw new ConflictError(`Slug "${slug}" is already taken.`);
  }

  const created = await Project.create({
    title,
    slug,
    domain,
    summary,
    role: draft.role?.trim() ?? '',
    stack: (draft.stack ?? []).map((s) => s.trim()).filter(Boolean),
    heroText: draft.heroText?.trim() ?? '',
    longDescription: draft.longDescription ?? '',
    links: toPersistLinks(draft.links),
    graph: toPersistGraph(draft.graph),
    order: draft.order ?? 0,
    featured: Boolean(draft.featured),
  });

  return { id: String(created._id), slug: created.slug };
}

/**
 * Update a project. NotFoundError if missing. The slug is IMMUTABLE — any
 * incoming slug is IGNORED (the decision is slug can't change post-creation).
 * `relatedPostSlugs` is derived and never written here. Returns id + slug.
 */
export async function updateProject(
  id: string,
  draft: ProjectDraft,
): Promise<{ id: string; slug: string }> {
  await connectToDatabase();
  if (!isValidObjectId(id)) throw new NotFoundError('Project not found.');

  const project = await Project.findById(id);
  if (!project) throw new NotFoundError('Project not found.');

  const title = draft.title?.trim();
  if (!title) throw new ValidationError('Title is required.');

  const summary = draft.summary?.trim();
  if (!summary) throw new ValidationError('Summary is required.');

  const domain = assertValidDomain(draft.domain);

  // Slug is immutable: keep the existing slug, ignore draft.slug entirely.
  project.title = title;
  project.domain = domain;
  project.summary = summary;
  project.role = draft.role?.trim() ?? '';
  project.stack = (draft.stack ?? []).map((s) => s.trim()).filter(Boolean);
  project.heroText = draft.heroText?.trim() ?? '';
  project.longDescription = draft.longDescription ?? '';
  // Subdocs assigned via `.set()` — the hydrated-doc types (DocumentArray, a
  // defaulted-required `graph.weight`) reject a plain object on direct assignment.
  project.set('links', toPersistLinks(draft.links));
  project.set('graph', toPersistGraph(draft.graph));
  project.order = draft.order ?? 0;
  project.featured = Boolean(draft.featured);
  await project.save();

  return { id: String(project._id), slug: project.slug };
}

/**
 * Delete a project. BLOCKED (409) when any Post still links to its slug — the
 * ConflictError carries `{ code:'linked_posts', count }` so the route can tell
 * the admin exactly how many posts to reassign first. NotFoundError if missing.
 * Returns the deleted project's slug so the caller can revalidate its public
 * pages WITHOUT a second read.
 */
export async function deleteProject(id: string): Promise<string> {
  await connectToDatabase();
  if (!isValidObjectId(id)) throw new NotFoundError('Project not found.');

  const project = await Project.findById(id).select('slug');
  if (!project) throw new NotFoundError('Project not found.');

  const count = await Post.countDocuments({ projectSlug: project.slug });
  if (count > 0) {
    throw new ConflictError(
      `Cannot delete: ${count} post${count === 1 ? '' : 's'} still ${count === 1 ? 'links' : 'link'} to this project. Reassign or delete them first.`,
      { code: 'linked_posts', count },
    );
  }

  await Project.deleteOne({ _id: id });
  return project.slug;
}
