import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { PostListItem } from '@/lib/types';
import { clusterVars, domainGlyph, domainLabel } from '@/lib/domain';
import { formatDate, isoDate, readTimeLabel } from '@/lib/format';
import { TagBadge } from './TagBadge';

interface PostCardProps {
  post: Pick<
    PostListItem,
    'slug' | 'title' | 'excerpt' | 'domain' | 'tags' | 'publishedAt' | 'readingTime'
  >;
}

/**
 * Blog post card. Whole card is one link to /blog/[slug]. Published posts only.
 * `domain` is nullable (a standalone essay has none) → neutral --info accent.
 */
export function PostCard({ post }: PostCardProps) {
  const { slug, title, excerpt, tags, publishedAt, readingTime } = post;
  const dom = post.domain ?? undefined;
  const shownTags = tags.slice(0, 3);

  const accent: CSSProperties = dom
    ? clusterVars(dom)
    : ({ '--cc': 'var(--info)', '--ct': 'var(--info)' } as CSSProperties);

  const style: CSSProperties = {
    ...accent,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '22px 20px 18px',
    boxShadow: 'var(--elev-1)',
    overflow: 'hidden',
    height: '100%',
  };

  return (
    <Link href={`/blog/${slug}`} style={style} className="az-card">
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: 'var(--cc)',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-faint)',
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        {dom && (
          <>
            <span aria-hidden="true" style={{ color: 'var(--ct)' }}>
              {domainGlyph(dom)}
            </span>
            <span
              style={{
                color: 'var(--ct)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {domainLabel(dom)}
            </span>
            <span aria-hidden="true">·</span>
          </>
        )}
        {publishedAt && (
          <>
            <time dateTime={isoDate(publishedAt)}>{formatDate(publishedAt)}</time>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>{readTimeLabel(readingTime)}</span>
      </div>
      <h2
        className="font-display"
        style={{
          margin: '0 0 10px',
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1.28,
          letterSpacing: '-0.01em',
          color: 'var(--text)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: '0 0 16px',
          fontSize: 14,
          color: 'var(--text-muted)',
          lineHeight: 1.55,
          flex: 1,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {excerpt}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {shownTags.map((t) => (
          <TagBadge key={t} label={t} domain={dom} size="xs" />
        ))}
      </div>
      <style>{`.az-card{transition:box-shadow var(--dur-fast) var(--ease-standard), transform var(--dur-fast);}
        .az-card:hover{box-shadow:var(--elev-2); transform:translateY(-2px);}`}</style>
    </Link>
  );
}

export default PostCard;
