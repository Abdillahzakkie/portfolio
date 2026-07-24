/**
 * POST /api/posts/[id]/publish — flip a post to published (stamps publishedAt on
 * first publish, validates the publish-gate fields). Mutating → middleware +
 * guard enforce auth. Node runtime.
 */

import { NextResponse } from 'next/server';
import { publishPost } from '@/server/services';
import { requireAdmin } from '../../../_lib/guard';
import { handleApiError } from '../../../_lib/responses';
import { revalidatePublicPost } from '../../../_lib/revalidate';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await params;
    const post = await publishPost(id);
    // The public home/blog/sitemap/RSS are statically prerendered — bust their
    // caches so a newly-published post appears without a rebuild.
    revalidatePublicPost(post.slug, post.projectSlug);
    return NextResponse.json({ post });
  } catch (error) {
    return handleApiError(error);
  }
}
