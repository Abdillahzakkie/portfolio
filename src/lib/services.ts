/**
 * Single integration seam between the public site and the backend service layer.
 *
 * The RSC pages call these server functions (each connects to the DB itself).
 * They are re-exported here so the public routes depend on ONE module; when the
 * backend's `@/server/services` barrel lands, integration is automatic.
 *
 * SHARED CONTRACT v1 signatures (see HANDOFF):
 *   getConstellation():                 { nodes: ProjectNodeData[] }
 *   getProjectView(slug):               ProjectView | null
 *   listPublishedPosts({ domain? }):    PostListItem[]
 *   getPublishedPost(slug):             { post, project, prevSlug, nextSlug } | null
 *
 * NOTE (self-check): if this file is the only one failing `tsc` with
 * "Cannot find module '@/server/services'", the backend service barrel has not
 * been merged yet — the orchestrator integrates it. Every consuming page casts
 * the result to the frontend view types in `@/lib/types`, so page-level type
 * safety holds regardless.
 */
export {
  getConstellation,
  getProjectView,
  listPublishedPosts,
  getPublishedPost,
} from '@/server/services';
