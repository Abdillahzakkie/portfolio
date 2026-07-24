import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/server/db/connect';
import { Project, Post, User } from '@/server/models';
import {
  createPost,
  publishPost,
  unpublishPost,
  updatePost,
  listPublishedPosts,
  getPublishedPost,
  getConstellation,
  getSitemapData,
  getRssItems,
  isSlugAvailable,
  ConflictError,
  ValidationError,
} from '@/server/services';
import type { PostDraft } from '@/server/services';
import { hashPassword, verifyLogin } from '@/server/auth/password';

/**
 * Integration tests against a THROWAWAY Mongo db (portfolio_vitest_<pid>) on the
 * shared Docker instance. NEVER the app `portfolio` db — asserted below before any
 * write, and the whole db is dropped in afterAll (even on failure).
 *
 * These prove the observable behaviour behind ACCEPTANCE #3/#4/#8 at the service
 * seam: draft invisibility, the publish lifecycle (stamp-once), slug uniqueness,
 * referential integrity, feed exclusion of drafts, and hash-free login.
 */

const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit '.repeat(20);

function draft(overrides: Partial<PostDraft> & { title: string; slug: string }): PostDraft {
  return {
    projectSlug: null,
    domain: null,
    tags: [],
    excerpt: '',
    body: WORDS,
    coverImage: '',
    status: 'draft',
    seo: {},
    ...overrides,
  };
}

beforeAll(async () => {
  await connectToDatabase();

  // HARD SAFETY GUARD — refuse to run against anything but a throwaway db.
  const dbName = mongoose.connection.name;
  if (dbName === 'portfolio' || !/^portfolio_vitest_/.test(dbName)) {
    throw new Error(
      `Refusing to run: connected to "${dbName}", not a portfolio_vitest_* throwaway db.`,
    );
  }

  // Fresh slate.
  await Promise.all([
    Post.deleteMany({}),
    Project.deleteMany({}),
    User.deleteMany({}),
  ]);

  // Two featured projects: one will get a published post, one stays bare.
  await Project.create([
    {
      title: 'Alpha Project',
      slug: 'alpha-project',
      domain: 'web3',
      summary: 'Alpha tagline',
      featured: true,
      order: 0,
      graph: { cluster: 'web3', weight: 3 },
    },
    {
      title: 'Beta Project',
      slug: 'beta-project',
      domain: 'security',
      summary: 'Beta tagline',
      featured: true,
      order: 0,
      graph: { cluster: 'security', weight: 1 },
    },
  ]);
});

afterAll(async () => {
  // Drop the entire throwaway db, then disconnect — leaves Mongo as found.
  if (mongoose.connection.readyState === 1) {
    const dbName = mongoose.connection.name;
    if (/^portfolio_vitest_/.test(dbName)) {
      await mongoose.connection.dropDatabase();
    }
  }
  await disconnectFromDatabase();
});

describe('DB safety', () => {
  it('is connected to a portfolio_vitest_* throwaway db, not the app db', () => {
    expect(mongoose.connection.name).not.toBe('portfolio');
    expect(mongoose.connection.name).toMatch(/^portfolio_vitest_/);
  });
});

describe('create → draft is invisible to the public (ACCEPTANCE #3/#4)', () => {
  it('createPost always yields a draft with a null publishedAt and a computed reading time', async () => {
    const out = await createPost(
      draft({ title: 'Alpha Write-up', slug: 'alpha-writeup', projectSlug: 'alpha-project' }),
    );
    expect(out.status).toBe('draft');
    expect(out.readingTime).toBeGreaterThan(0);

    const doc = await Post.findOne({ slug: 'alpha-writeup' }).lean();
    expect(doc?.status).toBe('draft');
    expect(doc?.publishedAt ?? null).toBeNull();
  });

  it('ignores an incoming status:published — new posts are ALWAYS drafts', async () => {
    const out = await createPost(
      draft({
        title: 'Sneaky Published',
        slug: 'sneaky-published',
        projectSlug: 'alpha-project',
        status: 'published',
      }),
    );
    expect(out.status).toBe('draft');
  });

  it('a draft is excluded from listPublishedPosts and returns null from getPublishedPost', async () => {
    const list = await listPublishedPosts();
    expect(list.some((p) => p.slug === 'alpha-writeup')).toBe(false);
    expect(await getPublishedPost('alpha-writeup')).toBeNull();
  });
});

describe('publish lifecycle stamps publishedAt exactly once (ACCEPTANCE #4)', () => {
  it('publish flips status→published and stamps publishedAt; the post becomes publicly readable', async () => {
    const doc = await Post.findOne({ slug: 'alpha-writeup' });
    const published = await publishPost(String(doc!._id));
    expect(published.status).toBe('published');

    const view = await getPublishedPost('alpha-writeup');
    expect(view).not.toBeNull();
    expect(view!.post.slug).toBe('alpha-writeup');
    expect(view!.project?.slug).toBe('alpha-project');

    const list = await listPublishedPosts();
    expect(list.some((p) => p.slug === 'alpha-writeup')).toBe(true);
  });

  it('re-publishing after an unpublish does NOT overwrite the original publishedAt', async () => {
    const id = String((await Post.findOne({ slug: 'alpha-writeup' }))!._id);
    const first = (await Post.findById(id).lean())!.publishedAt;
    expect(first).toBeTruthy();

    await unpublishPost(id);
    const afterUnpub = (await Post.findById(id).lean())!;
    expect(afterUnpub.status).toBe('draft');
    // publishedAt is retained on unpublish (so a later re-publish keeps the date).
    expect(afterUnpub.publishedAt?.toISOString()).toBe(first?.toISOString());

    await publishPost(id);
    const afterRepub = (await Post.findById(id).lean())!;
    expect(afterRepub.status).toBe('published');
    expect(afterRepub.publishedAt?.toISOString()).toBe(first?.toISOString());
  });

  it('unpublish reverts to draft and pulls the post from public reads', async () => {
    const id = String((await Post.findOne({ slug: 'sneaky-published' }))!._id);
    await publishPost(id);
    expect((await listPublishedPosts()).some((p) => p.slug === 'sneaky-published')).toBe(true);

    await unpublishPost(id);
    expect((await listPublishedPosts()).some((p) => p.slug === 'sneaky-published')).toBe(false);
    expect(await getPublishedPost('sneaky-published')).toBeNull();
  });
});

describe('slug uniqueness (ACCEPTANCE #4)', () => {
  it('rejects a duplicate slug with a ConflictError', async () => {
    await expect(
      createPost(draft({ title: 'Dup', slug: 'alpha-writeup', projectSlug: 'alpha-project' })),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('isSlugAvailable reflects taken vs free slugs', async () => {
    expect(await isSlugAvailable('alpha-writeup')).toBe(false);
    expect(await isSlugAvailable('a-totally-free-slug')).toBe(true);
  });
});

describe('referential integrity: projectSlug must reference an existing project', () => {
  it('rejects a post linked to an unknown project with a ValidationError', async () => {
    await expect(
      createPost(draft({ title: 'Orphan', slug: 'orphan-post', projectSlug: 'no-such-project' })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('allows a standalone essay with no project link (null)', async () => {
    const out = await createPost(draft({ title: 'Standalone', slug: 'standalone-essay' }));
    expect(out.projectSlug).toBeNull();
    expect(out.status).toBe('draft');
  });

  it('publish re-checks the project link exists at publish time', async () => {
    const doc = await Post.findOne({ slug: 'standalone-essay' });
    // A standalone essay has no project link → cannot publish (publish-gate).
    await expect(publishPost(String(doc!._id))).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('drafts never leak into the sitemap or RSS feeds (ACCEPTANCE #3)', () => {
  it('sitemap + RSS contain the published post and exclude every draft', async () => {
    // Ensure a known draft exists.
    await createPost(
      draft({ title: 'Draft Only', slug: 'draft-only-post', projectSlug: 'beta-project' }),
    );

    const { posts: sitemapPosts, projects: sitemapProjects } = await getSitemapData();
    const sitemapSlugs = sitemapPosts.map((p) => p.slug);
    expect(sitemapSlugs).toContain('alpha-writeup'); // published
    expect(sitemapSlugs).not.toContain('draft-only-post'); // draft
    expect(sitemapSlugs).not.toContain('standalone-essay'); // draft
    // Featured projects are listed.
    expect(sitemapProjects.map((p) => p.slug)).toEqual(
      expect.arrayContaining(['alpha-project', 'beta-project']),
    );

    const rssSlugs = (await getRssItems()).map((r) => r.slug);
    expect(rssSlugs).toContain('alpha-writeup');
    expect(rssSlugs).not.toContain('draft-only-post');
  });
});

describe('constellation derives hasPublishedPost from published posts (ACCEPTANCE #8)', () => {
  it('marks a project with a published post as hasPublishedPost, others false', async () => {
    const { nodes } = await getConstellation();
    const alpha = nodes.find((n) => n.slug === 'alpha-project');
    const beta = nodes.find((n) => n.slug === 'beta-project');
    expect(alpha?.hasPublishedPost).toBe(true);
    expect(alpha?.links.postSlug).toBe('alpha-writeup');
    expect(beta?.hasPublishedPost).toBe(false);
    expect(beta?.links.postSlug).toBeUndefined();
  });
});

describe('updatePost does not change publish state (lifecycle stays auditable)', () => {
  it('editing a published post preserves its published status + date', async () => {
    const before = (await Post.findOne({ slug: 'alpha-writeup' }).lean())!;
    const id = String(before._id);
    await updatePost(
      id,
      draft({
        title: 'Alpha Write-up (edited)',
        slug: 'alpha-writeup',
        projectSlug: 'alpha-project',
        body: WORDS + ' extra words',
      }),
    );
    const after = (await Post.findById(id).lean())!;
    expect(after.status).toBe('published');
    expect(after.publishedAt?.toISOString()).toBe(before.publishedAt?.toISOString());
    expect(after.title).toBe('Alpha Write-up (edited)');
  });
});

describe('verifyLogin never returns the passwordHash (ACCEPTANCE #4/#7)', () => {
  const EMAIL = 'qa-admin@local.test';
  const PASSWORD = 'QaSecret!2026';

  beforeAll(async () => {
    const passwordHash = await hashPassword(PASSWORD);
    await User.create({ email: EMAIL, passwordHash, role: 'admin', name: 'QA Admin' });
  });

  it('returns a hash-free PublicUser on correct credentials', async () => {
    const user = await verifyLogin(EMAIL, PASSWORD);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(EMAIL);
    expect('passwordHash' in (user as object)).toBe(false);
    expect(JSON.stringify(user)).not.toContain('$2'); // no bcrypt hash leaked
  });

  it('returns null on a wrong password', async () => {
    expect(await verifyLogin(EMAIL, 'wrong-password')).toBeNull();
  });

  it('returns null on an unknown email (no user enumeration signal)', async () => {
    expect(await verifyLogin('nobody@nowhere.test', 'whatever')).toBeNull();
  });
});
