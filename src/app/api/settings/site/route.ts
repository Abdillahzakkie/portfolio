/**
 * /api/settings/site
 *   GET   — the current site-wide settings. Auth-only (self-guarded).
 *   PATCH — update site settings (partial); revalidates the public surfaces.
 *
 * PATCH is gated by the middleware; GET self-guards.
 */

import { NextResponse } from 'next/server';
import { getSiteSettings, updateSiteSettings } from '@/server/services';
import { requireAdmin } from '../../_lib/guard';
import { siteSettingsSchema } from '../../_lib/validation';
import { badRequest, handleApiError } from '../../_lib/responses';
import { revalidateSiteSettings } from '../../_lib/revalidate';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
    const settings = await getSiteSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    const parsed = siteSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Invalid settings payload.');
    }
    const settings = await updateSiteSettings(parsed.data);
    revalidateSiteSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
