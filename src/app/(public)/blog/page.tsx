import type { Metadata } from 'next';
import type { PostListItem } from '@/lib/types';
import { listPublishedPosts } from '@/lib/services';
import { BlogIndexClient } from '@/components/public/BlogIndexClient';

export const metadata: Metadata = {
  title: 'Writing',
  description: 'Engineering notes across my work — Web3, security, and commerce.',
};

/** Blog index `/blog`. Published posts only (drafts excluded — #3), newest first. */
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
