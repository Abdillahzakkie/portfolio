/**
 * Thin client-side wrappers around the admin mutation API routes (SHARED
 * CONTRACT v1). Every call is a same-origin `fetch`, so the httpOnly session
 * cookie set by `POST /api/auth/login` rides along automatically — no token is
 * ever handled in JS. Non-2xx responses throw an {@link ApiError} carrying the
 * HTTP status so callers can branch (e.g. 401 → session expired, 409 → slug
 * conflict) while still showing users a generic message.
 */
import type { PostDraft } from './types';

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
