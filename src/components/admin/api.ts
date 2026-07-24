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

export function createPost(draft: PostDraft) {
  return request<SavedPost>('/api/posts', {
    method: 'POST',
    body: JSON.stringify(draft),
  });
}

export function updatePost(id: string, draft: Partial<PostDraft>) {
  return request<SavedPost>(`/api/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(draft),
  });
}

export function deletePost(id: string) {
  return request<void>(`/api/posts/${id}`, { method: 'DELETE' });
}

export function publishPost(id: string) {
  return request<SavedPost>(`/api/posts/${id}/publish`, { method: 'POST' });
}

export function unpublishPost(id: string) {
  return request<SavedPost>(`/api/posts/${id}/unpublish`, { method: 'POST' });
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
