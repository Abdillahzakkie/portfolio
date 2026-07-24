/**
 * Idempotent database seed. Run with `pnpm seed` (= `tsx src/server/seed/index.ts`).
 *
 * Sources project + post content from `@/content` (tech-writer's slice, which
 * exports `projects: ProjectSeedInput[]` and `posts: PostSeedInput[]`). Upserts
 * are keyed by slug so re-running is safe and non-duplicating. The static import
 * gives compile-time verification that content matches the seed-input contract.
 *
 * SECRETS: the admin password is read from env (`SEED_ADMIN_PASSWORD`). If unset,
 * a clearly-marked DEV default is used and PRINTED to the console — it is never
 * written to any committed file (ACCEPTANCE #7 / HANDOFF absolute guard).
 */

import { connectToDatabase, disconnectFromDatabase } from '@/server/db/connect';
import {
  Project,
  Post,
  User,
  type ProjectSeedInput,
  type PostSeedInput,
} from '@/server/models';
import { computeReadingTime } from '@/server/services';
import { hashPassword } from '@/server/auth/password';
// Content lives at repo-root `content/` (tech-writer's slice). The `@/*` alias
// maps to `src/*` only, so `@/content` does NOT resolve — use a relative path.
// (Flagged in HANDOFF: add a tsconfig `@/content` path if the alias is desired.)
import { projects as seedProjectData, posts as seedPostData } from '../../../content';

async function seedProjects(projects: ProjectSeedInput[]): Promise<Set<string>> {
  const slugs = new Set<string>();
  for (const p of projects) {
    const slug = p.slug.toLowerCase().trim();
    slugs.add(slug);
    await Project.findOneAndUpdate(
      { slug },
      {
        $set: {
          title: p.title,
          slug,
          domain: p.domain,
          summary: p.summary ?? '',
          role: p.role ?? '',
          stack: p.stack ?? [],
          links: p.links ?? {},
          heroText: p.heroText ?? '',
          longDescription: p.longDescription ?? '',
          graph: p.graph ?? {},
          order: p.order ?? 0,
          featured: p.featured ?? false,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    );
  }
  console.log(`  ✓ upserted ${projects.length} project(s)`);
  return slugs;
}

async function seedPosts(
  posts: PostSeedInput[],
  projectSlugs: Set<string>,
): Promise<void> {
  let orphaned = 0;
  for (const p of posts) {
    const slug = p.slug.toLowerCase().trim();
    const projectSlug = p.projectSlug ? p.projectSlug.toLowerCase().trim() : null;

    if (projectSlug && !projectSlugs.has(projectSlug)) {
      orphaned += 1;
      console.warn(
        `  ! post "${slug}" references unknown project "${projectSlug}" — leaving link, but no project will resolve it`,
      );
    }

    const status = p.status ?? 'draft';
    const existing = await Post.findOne({ slug }).select('publishedAt');

    // Preserve the ORIGINAL publish date on re-seed; only stamp on first publish.
    let publishedAt: Date | null = null;
    if (status === 'published') {
      publishedAt =
        existing?.publishedAt ?? (p.publishedAt ? new Date(p.publishedAt) : new Date());
    }

    await Post.findOneAndUpdate(
      { slug },
      {
        $set: {
          title: p.title,
          slug,
          status,
          publishedAt,
          excerpt: p.excerpt ?? '',
          body: p.body ?? '',
          coverImage: p.coverImage ?? '',
          projectSlug,
          tags: p.tags ?? [],
          seo: p.seo ?? {},
          readingTime: p.readingTime ?? computeReadingTime(p.body ?? ''),
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true },
    );
  }
  console.log(
    `  ✓ upserted ${posts.length} post(s)${orphaned ? ` (${orphaned} with unresolved project link)` : ''}`,
  );
}

/** Rebuild each project's denormalized relatedPostSlugs from published posts. */
async function rebuildRelatedPostSlugs(projectSlugs: Set<string>): Promise<void> {
  for (const slug of projectSlugs) {
    const related = await Post.find({ projectSlug: slug, status: 'published' })
      .sort({ publishedAt: -1 })
      .select('slug')
      .lean();
    await Project.updateOne(
      { slug },
      { $set: { relatedPostSlugs: related.map((r) => r.slug) } },
    );
  }
  console.log(`  ✓ rebuilt relatedPostSlugs for ${projectSlugs.size} project(s)`);
}

async function seedAdmin(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@local.test').toLowerCase().trim();
  const envPassword = process.env.SEED_ADMIN_PASSWORD;

  const password = envPassword || 'dev-admin-change-me';
  const usingDevDefault = !envPassword;

  const passwordHash = await hashPassword(password);

  // $setOnInsert: never reset an existing admin's password on re-seed (a rotated
  // credential must survive re-running). Delete the user first to force a reset.
  const result = await User.findOneAndUpdate(
    { email },
    {
      $setOnInsert: {
        email,
        passwordHash,
        role: 'admin',
        name: 'Abdullah Zakariyya',
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  const created = result?.createdAt && result.updatedAt
    ? String(result.createdAt) === String(result.updatedAt)
    : false;

  console.log(`  ✓ admin user ${created ? 'created' : 'ensured'}: ${email}`);
  if (usingDevDefault) {
    console.log('  ┌───────────────────────────────────────────────────────────────');
    console.log('  │ ⚠ DEV DEFAULT ADMIN PASSWORD IN USE (SEED_ADMIN_PASSWORD unset)');
    console.log(`  │   email:    ${email}`);
    console.log(`  │   password: ${password}`);
    console.log('  │ Set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD for any real env.');
    console.log('  └───────────────────────────────────────────────────────────────');
  } else {
    console.log('  (admin password taken from SEED_ADMIN_PASSWORD env — not printed)');
  }
}

async function main(): Promise<void> {
  console.log('> seeding database...');
  await connectToDatabase();

  const projects = seedProjectData;
  const posts = seedPostData;
  if (projects.length === 0 && posts.length === 0) {
    console.warn(
      '  ! @/content exported no projects/posts — did tech-writer land content/index.ts?',
    );
  }

  const projectSlugs = await seedProjects(projects);
  await seedPosts(posts, projectSlugs);
  await rebuildRelatedPostSlugs(projectSlugs);
  await seedAdmin();

  console.log('✔ seed complete');
}

main()
  .then(async () => {
    await disconnectFromDatabase();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('x seed failed:', err);
    await disconnectFromDatabase().catch(() => {});
    process.exit(1);
  });
