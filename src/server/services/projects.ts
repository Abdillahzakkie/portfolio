/**
 * Project services — the domain-graph home, the case-study page, and the admin
 * editor's project picker. Read-only; projects are authored via seed/content,
 * not the CMS.
 *
 * Every exported function connects to the DB first (idempotent, cached).
 */

import { connectToDatabase } from '@/server/db/connect';
import { Project, Post, type IProject, type Domain } from '@/server/models';
import type { ProjectNodeData, ProjectView } from './contracts';
import { toPostListItems } from './posts';

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
