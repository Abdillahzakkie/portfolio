/**
 * GET /api/projects/slug-check?slug=&exceptId= — live slug-uniqueness check for
 * the project editor. `available:true` ⇒ free to use. `exceptId` excludes the
 * project being edited. Auth-only (self-guarded — a GET, not covered by the
 * mutating-method middleware gate).
 */

import { NextResponse } from 'next/server';
import { isProjectSlugAvailable } from '@/server/services';
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

    const available = await isProjectSlugAvailable(slug, exceptId);
    return NextResponse.json({ available });
  } catch (error) {
    return handleApiError(error);
  }
}
