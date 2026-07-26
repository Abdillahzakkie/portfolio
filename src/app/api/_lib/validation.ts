/**
 * Zod input schemas for the API trust boundary. Routes parse untrusted request
 * bodies through these before handing typed data to a service. Business rules
 * (slug uniqueness, project existence) live in the service layer; these schemas
 * only enforce SHAPE + basic format.
 */

import { z } from 'zod';
import {
  DOMAINS,
  POST_STATUSES,
  SLUG_REGEX,
  SLUG_MIN,
  SLUG_MAX,
} from '@/server/models';
import type { PostDraft } from '@/server/services';

/** Login credentials. */
export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const slugSchema = z
  .string()
  .trim()
  .transform((s) => s.toLowerCase())
  .refine(
    (s) => s.length >= SLUG_MIN && s.length <= SLUG_MAX && SLUG_REGEX.test(s),
    `Slug must be ${SLUG_MIN}-${SLUG_MAX} lowercase letters, numbers, or hyphens.`,
  );

/** An empty/whitespace project slug is normalized to null (standalone essay). */
const projectSlugSchema = z
  .union([z.string(), z.null()])
  .transform((s) => {
    if (s == null) return null;
    const t = s.trim().toLowerCase();
    return t.length ? t : null;
  });

/**
 * The editor may send `domain: ''` for the "Auto from project / no domain"
 * selection (an empty <select> value). Coerce `''`/`undefined` → null BEFORE the
 * enum check so an empty selection is accepted as "no domain" (200) instead of
 * failing the `z.enum(DOMAINS)` validation (400). The service ignores `domain` on
 * write regardless (it's derived from the linked project) — this only keeps the
 * trust-boundary parse robust to what the client actually sends.
 */
const domainSchema = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.enum(DOMAINS).nullable(),
);

const seoSchema = z
  .object({
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    ogImage: z.string().optional(),
  })
  .default({});

/**
 * Editable post payload (create + update). `domain` is accepted but IGNORED by
 * the service (derived from the project); `readingTime` is recomputed server-side.
 * `status` is accepted but the create service always starts a post as a draft and
 * the update service preserves the current status — lifecycle goes through the
 * dedicated publish/unpublish endpoints.
 */
export const postDraftSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'Title is required.').max(200),
  slug: slugSchema,
  projectSlug: projectSlugSchema.default(null),
  domain: domainSchema.default(null),
  tags: z.array(z.string().trim().min(1)).default([]),
  excerpt: z.string().default(''),
  body: z.string().default(''),
  coverImage: z.string().default(''),
  status: z.enum(POST_STATUSES).default('draft'),
  seo: seoSchema,
  readingTime: z.number().int().nonnegative().optional(),
});

/** Parse an unknown body into a typed PostDraft, or throw ZodError. */
export function parsePostDraft(input: unknown): PostDraft {
  return postDraftSchema.parse(input) satisfies PostDraft;
}

// ---------------------------------------------------------------------------
// Projects (admin CRUD)
// ---------------------------------------------------------------------------

/**
 * A URL string, or the empty string (a cleared/optional link field).
 *
 * SECURITY: `z.string().url()` accepts `javascript:`, `data:`, and `vbscript:`
 * URLs — these persist and later flow into public `<a href>` / og:image, a
 * stored-XSS vector. Parse via `new URL()` and allow ONLY the `http:`/`https:`
 * schemes so a dangerous scheme is rejected at the trust boundary.
 */
const urlOrEmpty = z
  .string()
  .trim()
  .refine((v) => {
    if (v === '') return true;
    try {
      const { protocol } = new URL(v);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Enter a valid http(s) URL.');

/** An email string, or the empty string (a cleared contact field). */
const emailOrEmpty = z
  .string()
  .trim()
  .refine(
    (v) => v === '' || z.string().email().safeParse(v).success,
    'Must be a valid email.',
  );

const projectLinksSchema = z
  .object({
    repo: urlOrEmpty.optional(),
    live: urlOrEmpty.optional(),
    docs: urlOrEmpty.optional(),
    extra: z
      .array(
        z.object({
          label: z.string().trim().min(1),
          url: urlOrEmpty,
        }),
      )
      .optional(),
  })
  .default({});

const projectGraphSchema = z
  .object({
    cluster: z.string().trim().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    weight: z.number().optional(),
  })
  .default({});

/**
 * Editable project payload (create + update). `domain` is REQUIRED (a project
 * always belongs to a cluster — unlike a post, which derives it). `slug` is
 * validated on shape but the update service treats it as IMMUTABLE. `id` and
 * `relatedPostSlugs` are accepted but IGNORED by the service (the latter is a
 * server-derived cache owned by the post layer).
 */
export const projectDraftSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, 'Title is required.').max(200),
  slug: slugSchema,
  domain: z.enum(DOMAINS),
  summary: z.string().trim().min(1, 'Summary is required.'),
  role: z.string().default(''),
  stack: z.array(z.string().trim().min(1)).default([]),
  heroText: z.string().default(''),
  longDescription: z.string().default(''),
  links: projectLinksSchema,
  graph: projectGraphSchema,
  order: z.number().int().default(0),
  featured: z.boolean().default(false),
  // Server-derived, read-only cache — accepted but ignored on write.
  relatedPostSlugs: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Site-wide settings patch. Every field is `.optional()` so a PARTIAL patch is
 * valid (the frontend may send all fields, or just the changed ones). URL/email
 * fields accept the empty string (a cleared value).
 */
export const siteSettingsSchema = z.object({
  siteName: z.string().trim().min(1).max(120).optional(),
  siteDescription: z.string().trim().max(400).optional(),
  githubUrl: urlOrEmpty.optional(),
  contactEmail: emailOrEmpty.optional(),
  defaultOgImage: urlOrEmpty.optional(),
});

/** The admin's own display name. */
export const accountSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

/** Password-change payload. New password minimum length is enforced here AND in
 *  the service (defense in depth). */
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
