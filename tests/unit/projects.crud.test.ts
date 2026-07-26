import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/server/db/connect';
import { Project, Post } from '@/server/models';
import {
  listProjectsForAdmin,
  getProjectForEditor,
  isProjectSlugAvailable,
  createProject,
  updateProject,
  deleteProject,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/server/services';
import type { ProjectDraft } from '@/server/services';

/**
 * Admin Projects CRUD against a THROWAWAY Mongo db (portfolio_vitest_<pid>) on the
 * shared Docker instance — NEVER the app `portfolio` db (asserted before any write,
 * whole db dropped in afterAll even on failure).
 *
 * Behaviour under test (observable at the service seam): row projection + linked-
 * post counting, editor load / bad-id handling, slug availability, create-time
 * validation + uniqueness, slug IMMUTABILITY on update, and the delete-blocked-by-
 * linked-posts guard carrying an exact count. Every negative case would PASS
 * against a stripped implementation — so each asserts the specific guard fires.
 */

function draft(overrides: Partial<ProjectDraft> & { title: string; slug: string }): ProjectDraft {
  return {
    domain: 'web3',
    summary: 'A tagline for the project.',
    role: '',
    stack: [],
    heroText: '',
    longDescription: '',
    links: {},
    graph: {},
    order: 0,
    featured: false,
    relatedPostSlugs: [],
    ...overrides,
  };
}

// A valid, unique Post doc linked to `projectSlug` (any status), created directly
// so we control the linkage without going through the post publish-gate.
async function linkPost(projectSlug: string, slug: string) {
  return Post.create({ title: `Post ${slug}`, slug, body: 'x', projectSlug });
}

beforeAll(async () => {
  await connectToDatabase();
  const dbName = mongoose.connection.name;
  if (dbName === 'portfolio' || !/^portfolio_vitest_/.test(dbName)) {
    throw new Error(
      `Refusing to run: connected to "${dbName}", not a portfolio_vitest_* throwaway db.`,
    );
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    const dbName = mongoose.connection.name;
    if (/^portfolio_vitest_/.test(dbName)) {
      await mongoose.connection.dropDatabase();
    }
  }
  await disconnectFromDatabase();
});

beforeEach(async () => {
  // Isolate each test: a clean projects/posts slate.
  await Promise.all([Project.deleteMany({}), Post.deleteMany({})]);
});

describe('DB safety', () => {
  it('is connected to a portfolio_vitest_* throwaway db, not the app db', () => {
    expect(mongoose.connection.name).not.toBe('portfolio');
    expect(mongoose.connection.name).toMatch(/^portfolio_vitest_/);
  });
});

describe('createProject — happy path + validation guards', () => {
  it('creates a project and returns its id + slug', async () => {
    const out = await createProject(draft({ title: 'Alpha', slug: 'alpha-proj' }));
    expect(out.slug).toBe('alpha-proj');
    expect(mongoose.isValidObjectId(out.id)).toBe(true);

    const doc = await Project.findById(out.id).lean();
    expect(doc?.title).toBe('Alpha');
    expect(doc?.domain).toBe('web3');
    expect(doc?.summary).toBe('A tagline for the project.');
  });

  it('normalizes the slug to lowercase/trimmed before persisting', async () => {
    const out = await createProject(draft({ title: 'Beta', slug: '  Beta-Proj  ' }));
    expect(out.slug).toBe('beta-proj');
  });

  it('throws ValidationError when title is missing', async () => {
    await expect(
      createProject(draft({ title: '   ', slug: 'no-title' })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when summary is missing', async () => {
    await expect(
      createProject(draft({ title: 'No Summary', slug: 'no-summary', summary: '  ' })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError on a structurally invalid slug', async () => {
    await expect(
      createProject(draft({ title: 'Bad Slug', slug: 'ab' })), // too short
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError on a domain outside DOMAINS', async () => {
    await expect(
      createProject(draft({ title: 'Bad Domain', slug: 'bad-domain', domain: 'nope' as never })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ConflictError on a duplicate slug', async () => {
    await createProject(draft({ title: 'First', slug: 'dup-slug' }));
    await expect(
      createProject(draft({ title: 'Second', slug: 'dup-slug' })),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('listProjectsForAdmin — rows + linked-post counts', () => {
  it('projects each project into a row with a linked-post count (batched, any status)', async () => {
    const a = await createProject(draft({ title: 'Alpha', slug: 'alpha', order: 0 }));
    await createProject(draft({ title: 'Beta', slug: 'beta', order: 1 }));

    // Two posts (draft + published) link Alpha; none link Beta.
    await linkPost('alpha', 'alpha-one');
    const p2 = await linkPost('alpha', 'alpha-two');
    await Post.updateOne({ _id: p2._id }, { status: 'published' });

    const rows = await listProjectsForAdmin();
    const alphaRow = rows.find((r) => r.slug === 'alpha');
    const betaRow = rows.find((r) => r.slug === 'beta');

    expect(alphaRow).toMatchObject({ id: a.id, title: 'Alpha', domain: 'web3', order: 0 });
    expect(alphaRow?.relatedPostCount).toBe(2); // counts BOTH draft and published
    expect(betaRow?.relatedPostCount).toBe(0);
    expect(typeof alphaRow?.updatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(alphaRow!.updatedAt))).toBe(false);
  });

  it('returns an empty array when there are no projects', async () => {
    expect(await listProjectsForAdmin()).toEqual([]);
  });
});

describe('getProjectForEditor — load + bad-id handling', () => {
  it('loads an existing project into the ProjectDraft shape (incl. relatedPostSlugs)', async () => {
    const { id } = await createProject(
      draft({ title: 'Gamma', slug: 'gamma', role: 'Lead', stack: ['ts', 'go'] }),
    );
    const editor = await getProjectForEditor(id);
    expect(editor).not.toBeNull();
    expect(editor).toMatchObject({ id, title: 'Gamma', slug: 'gamma', role: 'Lead' });
    expect(editor?.stack).toEqual(['ts', 'go']);
    expect(Array.isArray(editor?.relatedPostSlugs)).toBe(true);
  });

  it('returns null for a syntactically invalid ObjectId', async () => {
    expect(await getProjectForEditor('not-a-valid-object-id')).toBeNull();
  });

  it('returns null for a well-formed but absent ObjectId', async () => {
    expect(await getProjectForEditor(new mongoose.Types.ObjectId().toString())).toBeNull();
  });
});

describe('isProjectSlugAvailable', () => {
  it('reflects taken vs free slugs, and excludes the edited project via exceptId', async () => {
    const { id } = await createProject(draft({ title: 'Delta', slug: 'delta-proj' }));
    expect(await isProjectSlugAvailable('delta-proj')).toBe(false); // taken
    expect(await isProjectSlugAvailable('a-free-slug')).toBe(true); // free
    // Editing the SAME project: its own slug is "available" to itself.
    expect(await isProjectSlugAvailable('delta-proj', id)).toBe(true);
    // A different id does not get the exemption.
    expect(
      await isProjectSlugAvailable('delta-proj', new mongoose.Types.ObjectId().toString()),
    ).toBe(false);
  });
});

describe('updateProject — slug is IMMUTABLE, fields mutate, NotFound guards', () => {
  it('ignores an incoming slug entirely (slug never changes on update)', async () => {
    const { id, slug } = await createProject(draft({ title: 'Epsilon', slug: 'epsilon-proj' }));

    const out = await updateProject(
      id,
      draft({
        title: 'Epsilon Renamed',
        slug: 'a-totally-different-slug', // MUST be ignored
        domain: 'security',
        summary: 'Updated tagline.',
      }),
    );

    // Returned slug is the original, not the one we passed.
    expect(out.slug).toBe(slug);
    expect(out.slug).toBe('epsilon-proj');

    const doc = await Project.findById(id).lean();
    expect(doc?.slug).toBe('epsilon-proj'); // persisted slug unchanged
    expect(doc?.title).toBe('Epsilon Renamed'); // other fields DID change
    expect(doc?.domain).toBe('security');
    expect(doc?.summary).toBe('Updated tagline.');
  });

  it('throws ValidationError when the update omits a required field (title/summary)', async () => {
    const { id } = await createProject(draft({ title: 'Zeta', slug: 'zeta-proj' }));
    await expect(
      updateProject(id, draft({ title: '  ', slug: 'zeta-proj' })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      updateProject(id, draft({ title: 'Zeta', slug: 'zeta-proj', summary: '  ' })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NotFoundError for an invalid or absent id', async () => {
    await expect(
      updateProject('not-an-id', draft({ title: 'X', slug: 'x-proj' })),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateProject(
        new mongoose.Types.ObjectId().toString(),
        draft({ title: 'X', slug: 'x-proj' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('deleteProject — blocked by linked posts with an exact count', () => {
  it('throws ConflictError carrying { code:"linked_posts", count } when posts link it', async () => {
    const { id } = await createProject(draft({ title: 'Eta', slug: 'eta-proj' }));
    await linkPost('eta-proj', 'eta-one');
    await linkPost('eta-proj', 'eta-two');
    await linkPost('eta-proj', 'eta-three');

    let caught: unknown;
    try {
      await deleteProject(id);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConflictError);
    expect((caught as ConflictError).details).toMatchObject({
      code: 'linked_posts',
      count: 3,
    });
    // The project MUST still exist (delete was blocked, not silently swallowed).
    expect(await Project.findById(id).lean()).not.toBeNull();
  });

  it('deletes successfully once no posts link it', async () => {
    const { id } = await createProject(draft({ title: 'Theta', slug: 'theta-proj' }));
    await linkPost('theta-proj', 'theta-one');

    // Blocked while the post exists.
    await expect(deleteProject(id)).rejects.toBeInstanceOf(ConflictError);

    // Remove the link, then it deletes.
    await Post.deleteMany({ projectSlug: 'theta-proj' });
    await deleteProject(id);
    expect(await Project.findById(id).lean()).toBeNull();
    expect(await getProjectForEditor(id)).toBeNull();
  });

  it('throws NotFoundError for an invalid or absent id', async () => {
    await expect(deleteProject('not-an-id')).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      deleteProject(new mongoose.Types.ObjectId().toString()),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
