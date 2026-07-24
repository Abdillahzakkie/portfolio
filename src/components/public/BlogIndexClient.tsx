'use client';

import { useState } from 'react';
import { DOMAINS, DOMAIN_LABELS, type Domain } from '@/server/models/types';
import type { PostListItem } from '@/lib/types';
import { domainGlyph } from '@/lib/domain';
import { PostCard } from './PostCard';
import { EmptyState } from './Feedback';

type Filter = 'all' | Domain;

interface BlogIndexClientProps {
  posts: PostListItem[];
}

/** Domain filter chips (client filter over the SSR list) + the PostCard grid. */
export function BlogIndexClient({ posts }: BlogIndexClientProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const filtered = filter === 'all' ? posts : posts.filter((p) => p.domain === filter);

  return (
    <>
      <div
        role="group"
        aria-label="Filter posts by domain"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 8,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 24,
        }}
      >
        <Chip active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
        {DOMAINS.map((d) => (
          <Chip
            key={d}
            active={filter === d}
            onClick={() => setFilter(d)}
            label={DOMAIN_LABELS[d]}
            glyph={domainGlyph(d)}
          />
        ))}
      </div>

      {posts.length === 0 ? (
        <EmptyState glyph="✎" title="No posts yet" body="New writing is on the way — check back soon." />
      ) : filtered.length === 0 ? (
        <EmptyState
          glyph="✎"
          title={`No posts in ${filter === 'all' ? 'this domain' : DOMAIN_LABELS[filter]} yet`}
          body="Try another domain filter."
        />
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: '28px 0 8px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {filtered.map((post) => (
            <li key={post.slug} style={{ minWidth: 0 }}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Chip({
  active,
  onClick,
  label,
  glyph,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  glyph?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        minHeight: 44,
        padding: '8px 16px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid',
        fontSize: 13.5,
        fontWeight: 600,
        cursor: 'pointer',
        background: active ? 'var(--text)' : 'var(--surface)',
        color: active ? 'var(--bg)' : 'var(--text-muted)',
        borderColor: active ? 'var(--text)' : 'var(--border-strong)',
      }}
    >
      {glyph && <span aria-hidden="true">{glyph}</span>}
      {label}
    </button>
  );
}

export default BlogIndexClient;
