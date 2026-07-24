/**
 * Barrel for the data-contract layer. Backend services and (for the pure types)
 * frontend code import from here:
 *
 *   import { Project, Post, User } from '@/server/models';          // models (server)
 *   import type { IPost, Domain, PostStatus } from '@/server/models'; // types (anywhere)
 *
 * The `./types` re-export is runtime-free, so importing a type from this barrel
 * pulls no mongoose into a client bundle (types are erased at build).
 */

export * from './types';

export { Project, default as ProjectModel } from './Project';
export type { ProjectDocument, ProjectDocProps } from './Project';

export { Post, default as PostModel } from './Post';
export type { PostDocument, PostDocProps } from './Post';

export { User, default as UserModel } from './User';
export type { UserDocument, UserDocProps } from './User';
