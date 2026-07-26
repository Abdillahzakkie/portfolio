/**
 * Settings services — the site-wide singleton config (site name/description,
 * social/contact, default OG image) and the admin's own profile.
 *
 * Business rules live HERE, not in the model or the route handlers. Every write
 * connects to the DB first. The site-settings READ is BOTH cached (it is read on
 * every public page — a hard perf requirement) AND resilient (public RSC must
 * never crash if Mongo is unreachable — it falls back to hardcoded defaults that
 * mirror the model defaults, so an empty/offline DB renders an identical site).
 */

import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import { connectToDatabase } from '@/server/db/connect';
import {
  SiteSettings,
  User,
  SITE_SETTINGS_KEY,
  type ISiteSettings,
  type PublicUser,
} from '@/server/models';
import { NotFoundError } from './errors';

/**
 * The cache tag the public read is stored under. The write path calls
 * `revalidateTag(SITE_SETTINGS_TAG)` (see `_lib/revalidate`) so an admin edit is
 * reflected on public pages immediately instead of at the next rebuild.
 */
export const SITE_SETTINGS_TAG = 'site-settings' as const;

/**
 * Hardcoded fallback — MUST mirror the SiteSettings model's field defaults so an
 * empty database (or a DB outage) renders an identical site. Timestamps are
 * placeholders; nothing reads them on the public surface.
 */
const DEFAULT_SITE_SETTINGS: ISiteSettings = {
  _id: SITE_SETTINGS_KEY,
  siteName: 'Abdullah Zakariyya',
  siteDescription:
    'A body of engineering work as a star map — Web3, Security, Commerce and Tools, with a companion write-up per project.',
  githubUrl: 'https://github.com',
  contactEmail: 'hello@example.com',
  defaultOgImage: '',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

/** Serialize a lean/plain SiteSettings doc into the public ISiteSettings shape. */
function toSiteSettings(doc: Record<string, unknown>): ISiteSettings {
  return {
    _id: String(doc._id),
    siteName: (doc.siteName as string) ?? DEFAULT_SITE_SETTINGS.siteName,
    siteDescription:
      (doc.siteDescription as string) ?? DEFAULT_SITE_SETTINGS.siteDescription,
    githubUrl: (doc.githubUrl as string) ?? DEFAULT_SITE_SETTINGS.githubUrl,
    contactEmail: (doc.contactEmail as string) ?? DEFAULT_SITE_SETTINGS.contactEmail,
    defaultOgImage:
      (doc.defaultOgImage as string) ?? DEFAULT_SITE_SETTINGS.defaultOgImage,
    createdAt: doc.createdAt
      ? new Date(doc.createdAt as Date).toISOString()
      : DEFAULT_SITE_SETTINGS.createdAt,
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt as Date).toISOString()
      : DEFAULT_SITE_SETTINGS.updatedAt,
  };
}

/**
 * Race-safe singleton read: upsert-on-first-read against the unique `key` index.
 * Throws on any DB failure (the caller catches and falls back) — so a transient
 * outage is NEVER cached as the defaults.
 */
async function loadSiteSettingsFromDb(): Promise<ISiteSettings> {
  await connectToDatabase();
  const doc = await SiteSettings.findOneAndUpdate(
    { key: SITE_SETTINGS_KEY },
    { $setOnInsert: { key: SITE_SETTINGS_KEY } },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  ).lean();
  // `doc` is non-null with returnDocument:'after' + upsert, but narrow defensively.
  if (!doc) return { ...DEFAULT_SITE_SETTINGS };
  return toSiteSettings(doc as Record<string, unknown>);
}

/** Cross-request cached read, tagged so the write path can revalidate it. */
const loadSiteSettingsCached = unstable_cache(
  loadSiteSettingsFromDb,
  ['site-settings'],
  { tags: [SITE_SETTINGS_TAG] },
);

/**
 * Public site settings. Cached (unstable_cache, cross-request) AND per-render
 * deduped (React cache). Resilient: ANY DB failure returns the hardcoded
 * defaults so a public RSC render never crashes when Mongo is down. A failure is
 * NOT cached (the inner cached fn throws; we catch OUTSIDE the cache), so the
 * next request retries the DB.
 */
export const getSiteSettings = cache(async (): Promise<ISiteSettings> => {
  try {
    return await loadSiteSettingsCached();
  } catch (error) {
    console.error('[settings] getSiteSettings falling back to defaults:', error);
    return { ...DEFAULT_SITE_SETTINGS };
  }
});

/** The five admin-editable site-settings fields. */
type SiteSettingsPatch = Partial<
  Pick<
    ISiteSettings,
    'siteName' | 'siteDescription' | 'githubUrl' | 'contactEmail' | 'defaultOgImage'
  >
>;

/**
 * Apply an admin patch to the singleton (upsert; only the provided fields are
 * `$set`). Returns the fresh settings. Callers MUST revalidate the
 * `SITE_SETTINGS_TAG` afterwards so the cached public read updates.
 */
export async function updateSiteSettings(
  patch: SiteSettingsPatch,
): Promise<ISiteSettings> {
  await connectToDatabase();

  const $set: SiteSettingsPatch = {};
  if (patch.siteName !== undefined) $set.siteName = patch.siteName;
  if (patch.siteDescription !== undefined) $set.siteDescription = patch.siteDescription;
  if (patch.githubUrl !== undefined) $set.githubUrl = patch.githubUrl;
  if (patch.contactEmail !== undefined) $set.contactEmail = patch.contactEmail;
  if (patch.defaultOgImage !== undefined) $set.defaultOgImage = patch.defaultOgImage;

  const doc = await SiteSettings.findOneAndUpdate(
    { key: SITE_SETTINGS_KEY },
    { $set, $setOnInsert: { key: SITE_SETTINGS_KEY } },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
      runValidators: true,
    },
  ).lean();

  if (!doc) return { ...DEFAULT_SITE_SETTINGS, ...$set };
  return toSiteSettings(doc as Record<string, unknown>);
}

/**
 * Update the admin's own display name. Returns the hash-free PublicUser (the
 * caller re-issues the session so the JWT `name` claim tracks the change).
 * NotFoundError if the user id no longer resolves.
 */
export async function updateProfile(
  userId: string,
  displayName: string,
): Promise<PublicUser> {
  await connectToDatabase();

  const name = displayName.trim();
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { name } },
    { returnDocument: 'after', runValidators: true },
  );
  if (!user) throw new NotFoundError('User not found.');

  // toJSON strips passwordHash (model transform); serialize to the public shape.
  return JSON.parse(JSON.stringify(user.toJSON())) as PublicUser;
}
