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
  ProjectRow,
  ProjectDraft,
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

// Project services (public reads + admin CRUD).
export {
  getConstellation,
  getProjectView,
  listProjectOptions,
  projectExists,
  listFeaturedProjectRefs,
  listProjectsForAdmin,
  getProjectForEditor,
  isProjectSlugAvailable,
  createProject,
  updateProject,
  deleteProject,
} from './projects';

// Settings services (site singleton + admin profile).
export {
  getSiteSettings,
  updateSiteSettings,
  updateProfile,
  SITE_SETTINGS_TAG,
} from './settings';

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
