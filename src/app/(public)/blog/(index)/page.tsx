import type { Metadata } from 'next';
import type { PostListItem } from '@/lib/types';
import { listPublishedPosts } from '@/lib/services';
import { BlogIndexClient } from '@/components/public/BlogIndexClient';

export const metadata: Metadata = {
  title: 'Writing',
  description: 'Engineering notes across my work — Web3, security, and commerce.',
};

/** Blog index `/blog`. Published posts only (drafts excluded — #3), newest first.
 *
 *  Lives in the `(index)` route group so its `loading.tsx` Suspense/streaming
 *  boundary scopes to THIS page only. A `loading.tsx` at the shared `blog/`
 *  segment would also wrap `blog/[slug]`, streaming a 200 shell before that
 *  route's `notFound()` resolves — a soft-404. Keeping the boundary here lets the
 *  dynamic post page emit a real 404 status (#3, #6). */
export default async function BlogIndexPage() {
  const posts = ((await listPublishedPosts({})) as PostListItem[]) ?? [];

  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: '24px 16px 40px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          className="font-display"
          style={{
            fontSize: 'clamp(2rem, 6vw, 2.5rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
          }}
        >
          Writing
        </h1>
        <p style={{ fontSize: 18, color: 'var(--text-muted)', margin: 0, maxWidth: '60ch' }}>
          Engineering notes across my work — Web3, security, and commerce.
        </p>
      </div>

      <BlogIndexClient posts={posts} />
    </div>
  );
}
