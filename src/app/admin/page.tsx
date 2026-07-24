import Link from 'next/link';
import { getSession } from '@/server/auth';
import { listPostsForAdmin } from '@/server/services';
import { AdminShell } from '@/components/admin/AdminShell';
import { PostTable } from '@/components/admin/PostTable';
import type { PostRow } from '@/components/admin/types';

export default async function AdminDashboardPage() {
  // Middleware guarantees a session; fall back to a neutral label if absent.
  const session = await getSession();
  const userName = session?.name ?? session?.email ?? 'Admin';

  // Fetch all posts for the initial render; the table filters client-side.
  const posts = (await listPostsForAdmin('all')) as PostRow[];

  const header = (
    <div className="flex flex-1 items-center justify-between gap-3">
      <h1
        className="m-0 text-[22px] font-bold"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
      >
        Posts
      </h1>
      <Link
        href="/admin/posts/new"
        data-testid="new-post"
        className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-white sm:h-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        style={{ background: 'var(--info)' }}
      >
        <span aria-hidden="true" className="text-base leading-none">
          ＋
        </span>
        New post
      </Link>
    </div>
  );

  return (
    <AdminShell activeNav="posts" user={{ name: userName }} header={header}>
      <PostTable initialPosts={posts} />
    </AdminShell>
  );
}
