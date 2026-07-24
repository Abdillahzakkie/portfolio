/**
 * /api/posts/[id]
 *   GET    — load a post into the editor (any status). Auth-only.
 *   PATCH  — update post content (does not change publish state). Auth-only.
 *   DELETE — delete a post. Auth-only.
 *
 * PATCH/DELETE are gated by the middleware; GET self-guards (drafts are private).
 */

import { NextResponse } from 'next/server';
import { getPostForEditor, updatePost, deletePost } from '@/server/services';
import { requireAdmin } from '../../_lib/guard';
import { postDraftSchema } from '../../_lib/validation';
import { badRequest, handleApiError } from '../../_lib/responses';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await params;
    const post = await getPostForEditor(id);
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found', code: 'not_found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = postDraftSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Invalid post payload.');
    }
    const updated = await updatePost(id, parsed.data);
    return NextResponse.json({ post: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await params;
    await deletePost(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
