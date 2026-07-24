/**
 * Frontend-facing view types.
 *
 * The core view shapes (`ProjectNodeData`, `PostListItem`, `ProjectView`) are
 * re-exported directly from the backend's runtime-free contract
 * (`@/server/services/contracts`) so there is ZERO drift between what the service
 * layer returns and what the public components consume. Importing them as types
 * pulls no mongoose into any client bundle.
 *
 * `ConstellationData` and `PublishedPostView` mirror the inline return shapes of
 * `getConstellation()` / `getPublishedPost()` (which the barrel does not export
 * as named types).
 */

import type { IPost } from '@/server/models';
import type {
  ProjectNodeData,
  PostListItem,
  ProjectView,
} from '@/server/services/contracts';

export type { ProjectNodeData, PostListItem, ProjectView };

/** Return shape of `getConstellation()`. */
export interface ConstellationData {
  nodes: ProjectNodeData[];
}

/** Return shape of `getPublishedPost(slug)`. */
export interface PublishedPostView {
  post: IPost;
  project: { slug: string; name: string; tagline: string } | null;
  prevSlug: string | null;
  nextSlug: string | null;
}
