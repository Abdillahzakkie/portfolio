/**
 * Public barrel for the service layer. Frontend (RSC + admin) and the API routes
 * import everything they need from here:
 *
 *   import { getConstellation, listPublishedPosts } from '@/server/services';
 *   import type { ProjectNodeData, PostDraft } from '@/server/services';
 *
 * Derived DTO types come from `./contracts` (runtime-free — safe to `import type`
 * from a client bundle). Service functions require a server runtime (they touch
 * mongoose).
 */

// Derived contract types (shared with frontend + qa).
export type {
  ProjectNodeData,
  PostListItem,
  PostRow,
  PostDraft,
  ProjectView,
  RssItem,
  SitemapData,
} from './contracts';

// Error taxonomy (routes map these to HTTP statuses).
export {
  ServiceError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from './errors';

// Project services.
export {
  getConstellation,
  getProjectView,
  listProjectOptions,
  projectExists,
  listFeaturedProjectRefs,
} from './projects';

// Post services (public reads + admin CMS + publish lifecycle).
export {
  listPublishedPosts,
  getPublishedPost,
  listPostsForAdmin,
  getPostForEditor,
  isSlugAvailable,
  createPost,
  updatePost,
  publishPost,
  unpublishPost,
  deletePost,
  computeReadingTime,
  toPostListItems,
} from './posts';

// SEO feed services.
export { getSitemapData, getRssItems } from './seo';
