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
