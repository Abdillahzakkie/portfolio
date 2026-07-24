/**
 * POST /api/posts/[id]/unpublish — revert a post to draft (removes it from public
 * reads + sitemap; retains publishedAt). Mutating → middleware + guard enforce
 * auth. Node runtime.
 */

import { NextResponse } from 'next/server';
import { unpublishPost } from '@/server/services';
import { requireAdmin } from '../../../_lib/guard';
import { handleApiError } from '../../../_lib/responses';
import { revalidatePublicPost } from '../../../_lib/revalidate';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await params;
    const post = await unpublishPost(id);
    // The post just left the public surface — bust the same prerendered caches so
    // it disappears from home/blog/sitemap/RSS without waiting for a rebuild.
    revalidatePublicPost(post.slug, post.projectSlug);
    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}
