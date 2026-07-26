/**
 * Thin client-side wrappers around the admin mutation API routes (SHARED
 * CONTRACT v1). Every call is a same-origin `fetch`, so the httpOnly session
 * cookie set by `POST /api/auth/login` rides along automatically — no token is
 * ever handled in JS. Non-2xx responses throw an {@link ApiError} carrying the
 * HTTP status so callers can branch (e.g. 401 → session expired, 409 → slug
 * conflict) while still showing users a generic message.
 */
import type { PostDraft, ProjectDraft } from './types';

export interface ApiError extends Error {
  status?: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    const err: ApiError = new Error('Network request failed');
    err.status = 0;
    throw err;
  }
  if (!res.ok) {
    const err: ApiError = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return (text ? (JSON.parse(text) as T) : (undefined as T));
}

// ---- auth ----------------------------------------------------------------

export function login(email: string, password: string) {
  return request<{ ok?: boolean }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

// ---- posts ---------------------------------------------------------------

export interface SavedPost {
  id: string;
  slug: string;
}

// The mutation routes wrap the saved post in a `{ post: … }` envelope (matching
// GET/PATCH/publish/unpublish). Unwrap it here so callers get a bare SavedPost —
// reading `.id`/`.slug` off the envelope silently yields undefined, which
// previously caused duplicate creates and a `/api/posts/undefined/publish` 404.
async function savePost(url: string, init: RequestInit): Promise<SavedPost> {
  const { post } = await request<{ post: SavedPost }>(url, init);
  return post;
}

// `domain` is a UI-only convenience field (the server derives it from the linked
// project and ignores it on write). It is `Domain | ''` in the editor; sending
// the empty string tripped the server's `z.enum(DOMAINS)` validation with a 400.
// Strip it from the wire payload entirely — the source of truth is `projectSlug`.
function toPayload<T extends { domain?: unknown }>(draft: T) {
  const rest: Record<string, unknown> = { ...draft };
  delete rest.domain;
  return rest;
}

export function createPost(draft: PostDraft) {
  return savePost('/api/posts', {
    method: 'POST',
    body: JSON.stringify(toPayload(draft)),
  });
}

export function updatePost(id: string, draft: Partial<PostDraft>) {
  return savePost(`/api/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(toPayload(draft)),
  });
}

export function deletePost(id: string) {
  return request<void>(`/api/posts/${id}`, { method: 'DELETE' });
}

export function publishPost(id: string) {
  return savePost(`/api/posts/${id}/publish`, { method: 'POST' });
}

export function unpublishPost(id: string) {
  return savePost(`/api/posts/${id}/unpublish`, { method: 'POST' });
}

export async function checkSlug(slug: string, exceptId?: string): Promise<boolean> {
  const params = new URLSearchParams({ slug });
  if (exceptId) params.set('exceptId', exceptId);
  const res = await request<{ available: boolean }>(
    `/api/posts/slug-check?${params.toString()}`,
    { method: 'GET' },
  );
  return Boolean(res?.available);
}

// ---- projects ------------------------------------------------------------

export interface SavedProject {
  id: string;
  slug: string;
}

// The project mutation routes wrap the saved project in a `{ project: … }`
// envelope (matching GET/PATCH). Unwrap it here so callers get a bare
// SavedProject — same pattern as `savePost`.
async function saveProject(url: string, init: RequestInit): Promise<SavedProject> {
  const { project } = await request<{ project: SavedProject }>(url, init);
  return project;
}

/**
 * Map the UI {@link ProjectDraft} onto the wire payload the API validates
 * (`projectDraftSchema`):
 *  - `relatedPostSlugs` is server-derived → DROPPED entirely.
 *  - Blank graph numbers (`''`) become `undefined` (NOT `0`) so the layout
 *    engine auto-places; `JSON.stringify` then omits them.
 *  - Empty `cluster` becomes `undefined` (blank means "default to the domain").
 *  - Extra-link rows with no label are dropped (the schema requires a label).
 *  - `slug` is INCLUDED on both create and update: it is immutable server-side
 *    (the update service ignores it) but the shared `projectDraftSchema` the
 *    PATCH route runs REQUIRES a valid slug, so omitting it would 400. Sending
 *    the unchanged, read-only slug honours immutability while passing validation.
 */
function toProjectPayload(draft: ProjectDraft) {
  const numOrUndef = (v: number | '') => (v === '' ? undefined : v);
  const extra = (draft.links.extra ?? [])
    .map((e) => ({ label: e.label.trim(), url: e.url.trim() }))
    .filter((e) => e.label.length > 0);
  return {
    title: draft.title,
    slug: draft.slug,
    domain: draft.domain,
    summary: draft.summary,
    role: draft.role,
    stack: draft.stack,
    heroText: draft.heroText,
    longDescription: draft.longDescription,
    links: {
      repo: draft.links.repo,
      live: draft.links.live,
      docs: draft.links.docs,
      extra,
    },
    graph: {
      cluster: draft.graph.cluster.trim() || undefined,
      x: numOrUndef(draft.graph.x),
      y: numOrUndef(draft.graph.y),
      weight: numOrUndef(draft.graph.weight),
    },
    order: draft.order,
    featured: draft.featured,
  };
}

export function createProject(draft: ProjectDraft) {
  return saveProject('/api/projects', {
    method: 'POST',
    body: JSON.stringify(toProjectPayload(draft)),
  });
}

export function updateProject(id: string, draft: ProjectDraft) {
  return saveProject(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(toProjectPayload(draft)),
  });
}

/** A delete that failed because posts still link the project (HTTP 409). */
export interface ProjectDeleteError extends ApiError {
  code?: string;
  /** Number of posts linking the project, from the 409 body. */
  count?: number;
}

/**
 * DELETE a project. The shared {@link request} helper throws an ApiError that
 * only carries `.status`; the 409 "linked posts" response also carries a
 * `count` the UI needs to explain the block, so this variant parses the 409
 * body and attaches `code` + `count` to the thrown error.
 */
export async function deleteProject(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    const err: ProjectDeleteError = new Error('Network request failed');
    err.status = 0;
    throw err;
  }
  if (res.ok) return;
  const err: ProjectDeleteError = new Error(`Request failed (${res.status})`);
  err.status = res.status;
  if (res.status === 409) {
    try {
      const body = (await res.json()) as { code?: string; count?: number };
      err.code = body.code;
      err.count = body.count;
    } catch {
      /* fall through to a generic delete error */
    }
  }
  throw err;
}

export async function checkProjectSlug(slug: string, exceptId?: string): Promise<boolean> {
  const params = new URLSearchParams({ slug });
  if (exceptId) params.set('exceptId', exceptId);
  const res = await request<{ available: boolean }>(
    `/api/projects/slug-check?${params.toString()}`,
    { method: 'GET' },
  );
  return Boolean(res?.available);
}

// ---- settings ------------------------------------------------------------

export function updateAccount(displayName: string) {
  return request<{ ok: boolean }>('/api/settings/account', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ ok: boolean }>('/api/settings/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export interface SiteSettingsInput {
  siteName: string;
  siteDescription: string;
  githubUrl: string;
  contactEmail: string;
  defaultOgImage: string;
}

export function saveSiteSettings(input: SiteSettingsInput) {
  return request<{ settings: unknown }>('/api/settings/site', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
