/**
 * GET /api/posts/slug-check?slug=&exceptId= — live slug-uniqueness check for the
 * editor. `available:true` ⇒ free to use. `exceptId` excludes the post being
 * edited (so re-saving its own slug isn't a conflict). Auth-only (self-guarded —
 * it is a GET, not covered by the mutating-method middleware gate).
 */

import { NextResponse } from 'next/server';
import { isSlugAvailable } from '@/server/services';
import { requireAdmin } from '../../_lib/guard';
import { badRequest, handleApiError } from '../../_lib/responses';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<NextResponse> {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug')?.trim();
    const exceptId = url.searchParams.get('exceptId')?.trim() || undefined;
    if (!slug) return badRequest('Query parameter "slug" is required.');

    const available = await isSlugAvailable(slug, exceptId);
    return NextResponse.json({ available });
  } catch (error) {
    return handleApiError(error);
  }
}
