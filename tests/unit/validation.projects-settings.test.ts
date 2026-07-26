import { describe, it, expect } from 'vitest';
import {
  projectDraftSchema,
  siteSettingsSchema,
  accountSchema,
  passwordChangeSchema,
} from '@/app/api/_lib/validation';

/**
 * Pure trust-boundary tests for the Projects + Settings zod schemas — no DB.
 *
 * These guard the API's parse layer: the SHAPE + format rules that reject a
 * malformed body BEFORE it ever reaches a service (business rules like slug
 * uniqueness live one layer deeper and are covered in the *.crud tests). Each
 * negative case asserts a specific field rule fails; each positive case asserts
 * the parsed/normalized output the service will receive.
 */

// A minimal-but-complete valid project draft body the editor would POST.
function validProjectBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Manage Renta',
    slug: 'manage-renta',
    domain: 'web3',
    summary: 'A property-management platform.',
    ...overrides,
  };
}

describe('projectDraftSchema', () => {
  it('accepts a minimal valid draft and applies field defaults', () => {
    const parsed = projectDraftSchema.parse(validProjectBody());
    expect(parsed.title).toBe('Manage Renta');
    expect(parsed.slug).toBe('manage-renta');
    expect(parsed.domain).toBe('web3');
    // Optional fields default rather than being required.
    expect(parsed.role).toBe('');
    expect(parsed.stack).toEqual([]);
    expect(parsed.heroText).toBe('');
    expect(parsed.longDescription).toBe('');
    expect(parsed.links).toEqual({});
    expect(parsed.graph).toEqual({});
    expect(parsed.order).toBe(0);
    expect(parsed.featured).toBe(false);
    expect(parsed.relatedPostSlugs).toEqual([]);
  });

  it('lowercases + trims the slug via transform', () => {
    const parsed = projectDraftSchema.parse(validProjectBody({ slug: '  Manage-Renta  ' }));
    expect(parsed.slug).toBe('manage-renta');
  });

  it('rejects a missing/empty title', () => {
    expect(projectDraftSchema.safeParse(validProjectBody({ title: '' })).success).toBe(false);
    const noTitle: Record<string, unknown> = { ...validProjectBody() };
    delete noTitle.title;
    expect(projectDraftSchema.safeParse(noTitle).success).toBe(false);
  });

  it('rejects a missing/empty summary (required)', () => {
    expect(projectDraftSchema.safeParse(validProjectBody({ summary: '' })).success).toBe(false);
    const noSummary: Record<string, unknown> = { ...validProjectBody() };
    delete noSummary.summary;
    expect(projectDraftSchema.safeParse(noSummary).success).toBe(false);
  });

  it('rejects a structurally invalid slug (spaces/punctuation survive lowercasing)', () => {
    // slugSchema lowercases BEFORE the regex check, so casing alone is not enough
    // to fail — the value must be regex-invalid even after normalization.
    expect(projectDraftSchema.safeParse(validProjectBody({ slug: 'bad slug!' })).success).toBe(
      false,
    );
    expect(projectDraftSchema.safeParse(validProjectBody({ slug: 'under_score' })).success).toBe(
      false,
    );
    expect(projectDraftSchema.safeParse(validProjectBody({ slug: '-leading' })).success).toBe(
      false,
    );
    // Too short (< SLUG_MIN = 3).
    expect(projectDraftSchema.safeParse(validProjectBody({ slug: 'ab' })).success).toBe(false);
  });

  it('requires domain and rejects an unknown domain value', () => {
    const noDomain: Record<string, unknown> = { ...validProjectBody() };
    delete noDomain.domain;
    expect(projectDraftSchema.safeParse(noDomain).success).toBe(false);
    expect(projectDraftSchema.safeParse(validProjectBody({ domain: 'nope' })).success).toBe(false);
    // Unlike postDraftSchema, an empty domain is NOT coerced to null here.
    expect(projectDraftSchema.safeParse(validProjectBody({ domain: '' })).success).toBe(false);
  });

  it('accepts every known domain', () => {
    for (const d of ['web3', 'security', 'commerce', 'tools-labs']) {
      expect(projectDraftSchema.safeParse(validProjectBody({ domain: d })).success).toBe(true);
    }
  });

  it('rejects a malformed link URL but accepts an empty (cleared) link', () => {
    expect(
      projectDraftSchema.safeParse(validProjectBody({ links: { repo: 'not-a-url' } })).success,
    ).toBe(false);
    expect(
      projectDraftSchema.safeParse(validProjectBody({ links: { repo: '' } })).success,
    ).toBe(true);
    expect(
      projectDraftSchema.safeParse(
        validProjectBody({ links: { repo: 'https://github.com/x/y' } }),
      ).success,
    ).toBe(true);
  });
});

describe('siteSettingsSchema (partial patch)', () => {
  it('accepts an empty patch (every field optional)', () => {
    const parsed = siteSettingsSchema.parse({});
    expect(parsed).toEqual({});
  });

  it('accepts a single-field patch and trims it', () => {
    const parsed = siteSettingsSchema.parse({ siteName: '  New Name  ' });
    expect(parsed.siteName).toBe('New Name');
    expect(parsed.siteDescription).toBeUndefined();
  });

  it('rejects an empty siteName (min 1 after trim)', () => {
    expect(siteSettingsSchema.safeParse({ siteName: '   ' }).success).toBe(false);
  });

  it('rejects a siteName over 120 chars', () => {
    expect(siteSettingsSchema.safeParse({ siteName: 'x'.repeat(121) }).success).toBe(false);
  });

  it('validates githubUrl as a URL but accepts empty (cleared)', () => {
    expect(siteSettingsSchema.safeParse({ githubUrl: 'not-a-url' }).success).toBe(false);
    expect(siteSettingsSchema.safeParse({ githubUrl: '' }).success).toBe(true);
    expect(siteSettingsSchema.safeParse({ githubUrl: 'https://github.com/az' }).success).toBe(true);
  });

  it('validates contactEmail as an email but accepts empty (cleared)', () => {
    expect(siteSettingsSchema.safeParse({ contactEmail: 'nope' }).success).toBe(false);
    expect(siteSettingsSchema.safeParse({ contactEmail: '' }).success).toBe(true);
    expect(siteSettingsSchema.safeParse({ contactEmail: 'hi@example.com' }).success).toBe(true);
  });
});

describe('accountSchema (display name)', () => {
  it('accepts a valid display name and trims it', () => {
    const parsed = accountSchema.parse({ displayName: '  Abdullah  ' });
    expect(parsed.displayName).toBe('Abdullah');
  });

  it('rejects an empty / whitespace-only display name', () => {
    expect(accountSchema.safeParse({ displayName: '' }).success).toBe(false);
    expect(accountSchema.safeParse({ displayName: '   ' }).success).toBe(false);
  });

  it('rejects a display name over 80 chars', () => {
    expect(accountSchema.safeParse({ displayName: 'x'.repeat(81) }).success).toBe(false);
  });
});

describe('passwordChangeSchema', () => {
  it('accepts a valid pair (current present, new >= 8)', () => {
    const parsed = passwordChangeSchema.parse({
      currentPassword: 'x',
      newPassword: 'abcdefgh',
    });
    expect(parsed.newPassword).toBe('abcdefgh');
  });

  it('rejects a new password shorter than 8 chars', () => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: 'x', newPassword: 'short' }).success,
    ).toBe(false);
    // Exactly 7 is still too short (boundary).
    expect(
      passwordChangeSchema.safeParse({ currentPassword: 'x', newPassword: '1234567' }).success,
    ).toBe(false);
  });

  it('rejects an empty current password', () => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: '', newPassword: 'abcdefgh' }).success,
    ).toBe(false);
  });
});
