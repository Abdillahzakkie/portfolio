import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ProjectView } from '@/lib/types';
import { getProjectView } from '@/lib/services';
import { BackLink } from '@/components/public/BackLink';
import { CaseStudyHeader } from '@/components/public/CaseStudyHeader';
import { AtAGlance } from '@/components/public/AtAGlance';
import { PostBody } from '@/components/public/PostBody';
import { PostCard } from '@/components/public/PostCard';
import { EmptyState } from '@/components/public/Feedback';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const view = (await getProjectView(slug)) as ProjectView | null;
  if (!view) return { title: 'Project not found' };
  const { project } = view;
  return {
    title: project.title,
    description: project.summary || project.heroText,
    openGraph: {
      title: project.title,
      description: project.summary || project.heroText,
      type: 'article',
    },
  };
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  // Missing slugs → 404. This route intentionally has NO `loading.tsx`: a
  // streaming boundary would flush a 200 shell before notFound() resolves,
  // yielding a soft-404. Rendering unstreamed lets Next set a real 404 status
  // (#3 correctness + #6 SEO). Verified against a production server.
  const view = (await getProjectView(slug)) as ProjectView | null;
  if (!view) notFound();

  const { project, relatedPosts, related } = view;
  const primaryPost = relatedPosts[0]?.slug;
  const hasPublished = relatedPosts.length > 0;

  const links = {
    repo: project.links?.repo,
    live: project.links?.live,
    post: primaryPost,
  };

  return (
    <div
      style={{
        maxWidth: 'var(--content-max)',
        margin: '0 auto',
        padding: '16px 16px 40px',
      }}
    >
      <BackLink href="/" label="Back to constellation" />

      <CaseStudyHeader
        name={project.title}
        domain={project.domain}
        tagline={project.summary || project.heroText}
        stack={project.stack ?? []}
        links={links}
        status={hasPublished ? 'published' : 'draft'}
      />

      <div className="az-cs-cols" style={{ display: 'grid', gap: 40, alignItems: 'start' }}>
        <article style={{ minWidth: 0 }}>
          <h2
            className="font-display"
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              margin: '0 0 14px',
            }}
          >
            Overview
          </h2>
          {project.longDescription ? (
            <PostBody source={project.longDescription} domain={project.domain} />
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>{project.heroText || project.summary}</p>
          )}
        </article>

        <AtAGlance
          role={project.role || undefined}
          domain={project.domain}
          related={related ?? []}
          links={links}
        />
      </div>

      <section
        aria-label="Related write-ups"
        style={{ marginTop: 52, paddingTop: 36, borderTop: '1px solid var(--border)' }}
      >
        <h2
          className="font-display"
          style={{ fontSize: 24, fontWeight: 700, margin: '0 0 18px' }}
        >
          Related write-ups
        </h2>
        {relatedPosts.length > 0 ? (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
              maxWidth: 800,
            }}
          >
            {relatedPosts.map((post) => (
              <li key={post.slug} style={{ minWidth: 0 }}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            glyph="✎"
            title="Write-up in progress"
            body="A companion post for this project is being drafted. Check back soon."
          />
        )}
      </section>

      <style>{`@media (min-width: 1024px){ .az-cs-cols{ grid-template-columns: 1fr 320px; gap: 48px; } }`}</style>
    </div>
  );
}
