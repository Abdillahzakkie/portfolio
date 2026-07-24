/**
 * /api/posts
 *   GET  — admin post list (all statuses; ?filter=all|published|drafts). Auth-only.
 *   POST — create a post (starts as draft). Auth enforced by middleware + guard.
 *
 * Thin transport: validate input, delegate to the service, map errors.
 */

import { NextResponse } from 'next/server';
import { listPostsForAdmin, createPost } from '@/server/services';
import { requireAdmin } from '../_lib/guard';
import { postDraftSchema } from '../_lib/validation';
import { badRequest, handleApiError } from '../_lib/responses';

export const runtime = 'nodejs';

const FILTERS = new Set(['all', 'published', 'drafts']);

export async function GET(req: Request): Promise<NextResponse> {
  try {
    await requireAdmin();
    const raw = new URL(req.url).searchParams.get('filter') ?? 'all';
    const filter = FILTERS.has(raw) ? (raw as 'all' | 'published' | 'drafts') : 'all';
    const posts = await listPostsForAdmin(filter);
    return NextResponse.json({ posts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const parsed = postDraftSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Invalid post payload.');
    }
    const created = await createPost(parsed.data);
    return NextResponse.json({ post: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
