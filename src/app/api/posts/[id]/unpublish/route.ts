/**
 * POST /api/posts/[id]/unpublish — revert a post to draft (removes it from public
 * reads + sitemap; retains publishedAt). Mutating → middleware + guard enforce
 * auth. Node runtime.
 */

import { NextResponse } from 'next/server';
import { unpublishPost } from '@/server/services';
import { requireAdmin } from '../../../_lib/guard';
import { handleApiError } from '../../../_lib/responses';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await params;
    const post = await unpublishPost(id);
    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}
