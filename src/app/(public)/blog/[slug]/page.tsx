import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Domain } from '@/server/models/types';
import type { PublishedPostView } from '@/lib/types';
import { getPublishedPost } from '@/lib/services';
import { domainGlyph, domainLabel } from '@/lib/domain';
import { formatDate, isoDate, readTimeLabel } from '@/lib/format';
import { BackLink } from '@/components/public/BackLink';
import { TagBadge } from '@/components/public/TagBadge';
import { PostBody } from '@/components/public/PostBody';
import { ProjectBacklink } from '@/components/public/ProjectBacklink';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** The single-post contract does not carry a domain; read it defensively if the
 *  backend adds one to the post/project (see HANDOFF). Falls back to undefined. */
function domainOf(view: PublishedPostView): Domain | undefined {
  const fromPost = (view.post as unknown as { domain?: Domain }).domain;
  const fromProject = (view.project as unknown as { domain?: Domain } | null)?.domain;
  return fromPost ?? fromProject ?? undefined;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const view = (await getPublishedPost(slug)) as PublishedPostView | null;
  if (!view) return { title: 'Post not found' };
  const { post } = view;
  const desc = post.seo?.metaDescription || post.excerpt;
  return {
    title: post.seo?.metaTitle || post.title,
    description: desc,
    openGraph: {
      title: post.title,
      description: desc,
      type: 'article',
      publishedTime: post.publishedAt ?? undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  // Drafts / unknown slugs resolve to null for anonymous readers → 404 (#3).
  const view = (await getPublishedPost(slug)) as PublishedPostView | null;
  if (!view) notFound();

  const { post, project, prevSlug, nextSlug } = view;
  const domain = domainOf(view);

  return (
    <article
      style={{ maxWidth: 760, margin: '0 auto', padding: '16px 16px 40px' }}
    >
      <BackLink href="/blog" label="All writing" />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-faint)',
          margin: '8px 0 14px',
        }}
      >
        {domain && (
          <>
            <span aria-hidden="true" style={{ color: 'var(--info)' }}>
              {domainGlyph(domain)}
            </span>
            <span
              style={{
                color: 'var(--info)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {domainLabel(domain)}
            </span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>{readTimeLabel(post.readingTime)}</span>
        {post.publishedAt && (
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={isoDate(post.publishedAt)}>{formatDate(post.publishedAt)}</time>
          </>
        )}
      </div>

      <h1
        className="font-display"
        style={{
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontSize: 'clamp(2rem, 6vw, 2.75rem)',
          lineHeight: 1.1,
          margin: '0 0 16px',
        }}
      >
        {post.title}
      </h1>

      {post.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 26 }}>
          {post.tags.map((t) => (
            <TagBadge key={t} label={t} domain={domain} size="sm" />
          ))}
        </div>
      )}

      {project && (
        <div style={{ marginBottom: 40 }}>
          <ProjectBacklink project={project} domain={domain} variant="banner" />
        </div>
      )}

      <PostBody source={post.body} domain={domain} />

      <div
        aria-hidden="true"
        style={{
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontSize: 13,
          letterSpacing: '0.3em',
          margin: '40px 0',
        }}
      >
        · · ·
      </div>

      {project && (
        <div style={{ marginBottom: 8 }}>
          <ProjectBacklink project={project} domain={domain} variant="footer" />
        </div>
      )}

      {(prevSlug || nextSlug) && (
        <nav
          aria-label="Post navigation"
          style={{ borderTop: '1px solid var(--border)', paddingTop: 28, marginTop: 24 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              fontSize: 14,
              flexWrap: 'wrap',
            }}
          >
            {prevSlug ? (
              <Link href={`/blog/${prevSlug}`} style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                ← Previous post
              </Link>
            ) : (
              <span />
            )}
            {nextSlug ? (
              <Link href={`/blog/${nextSlug}`} style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                Next post →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </nav>
      )}
    </article>
  );
}
