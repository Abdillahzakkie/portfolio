/**
 * GET /api/projects — {slug,name}[] of every project, for the editor's "link to a
 * project" select (ACCEPTANCE #3 requires each post to link a project). Auth-only
 * (self-guarded — a GET, so not covered by the mutating-method middleware gate).
 */

import { NextResponse } from 'next/server';
import { listProjectOptions } from '@/server/services';
import { requireAdmin } from '../_lib/guard';
import { handleApiError } from '../_lib/responses';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const projects = await listProjectOptions();
    return NextResponse.json({ projects });
  } catch (error) {
    return handleApiError(error);
  }
}
