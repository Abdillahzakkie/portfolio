/**
 * /api/projects
 *   GET  — {slug,name}[] of every project, for the editor's "link to a project"
 *          select (ACCEPTANCE #3 requires each post to link a project). Auth-only
 *          (self-guarded — a GET, not covered by the mutating-method gate).
 *   POST — create a project. Auth enforced by middleware + guard.
 *
 * Thin transport: validate input, delegate to the service, map errors.
 */

import { NextResponse } from 'next/server';
import { listProjectOptions, createProject } from '@/server/services';
import { requireAdmin } from '../_lib/guard';
import { projectDraftSchema } from '../_lib/validation';
import { badRequest, handleApiError } from '../_lib/responses';
import { revalidatePublicProject } from '../_lib/revalidate';

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

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const parsed = projectDraftSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Invalid project payload.');
    }
    const project = await createProject(parsed.data);
    revalidatePublicProject(project.slug);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
