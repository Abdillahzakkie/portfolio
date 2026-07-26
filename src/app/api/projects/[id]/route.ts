/**
 * /api/projects/[id]
 *   GET    — load a project into the editor. Auth-only (self-guarded).
 *   PATCH  — update a project (slug is immutable server-side). Auth-only.
 *   DELETE — delete a project; BLOCKED with 409 when posts still link to it.
 *
 * PATCH/DELETE are gated by the middleware; GET self-guards.
 */

import { NextResponse } from 'next/server';
import {
  getProjectForEditor,
  updateProject,
  deleteProject,
  ConflictError,
} from '@/server/services';
import { requireAdmin } from '../../_lib/guard';
import { projectDraftSchema } from '../../_lib/validation';
import { badRequest, handleApiError } from '../../_lib/responses';
import { revalidatePublicProject } from '../../_lib/revalidate';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await params;
    const project = await getProjectForEditor(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'not_found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = projectDraftSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Invalid project payload.');
    }
    const project = await updateProject(id, parsed.data);
    revalidatePublicProject(project.slug);
    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params): Promise<NextResponse> {
  try {
    await requireAdmin();
    const { id } = await params;
    // deleteProject returns the deleted project's slug (looked up internally for
    // the linked-posts guard) — reuse it to revalidate the public pages instead
    // of a second full read.
    const slug = await deleteProject(id);
    revalidatePublicProject(slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // A delete blocked by linked posts is a ConflictError carrying the count —
    // surface a structured 409 the admin UI can act on (how many to reassign).
    if (
      error instanceof ConflictError &&
      error.details?.code === 'linked_posts'
    ) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'linked_posts',
          count: error.details.count,
        },
        { status: 409 },
      );
    }
    return handleApiError(error);
  }
}
