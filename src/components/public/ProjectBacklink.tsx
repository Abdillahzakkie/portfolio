import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Domain } from '@/server/models/types';
import { clusterVars, domainGlyph } from '@/lib/domain';

interface ProjectBacklinkProps {
  project: { slug: string; name: string; tagline: string };
  /** Tints the card to the project's domain; falls back to the neutral --info
   *  accent when the single-post contract doesn't carry a domain (flagged). */
  domain?: Domain;
  variant: 'banner' | 'footer';
}

/**
 * Post → project backlink card (ACCEPTANCE #3). Rendered prominently near the top
 * (banner) AND in the footer of every post, so "link back to its project" is
 * unmissable. Carries data-testid="post-project-backlink" for the QA assertion.
 */
export function ProjectBacklink({ project, domain, variant }: ProjectBacklinkProps) {
  const eyebrow = variant === 'banner' ? 'Part of the project' : 'Back to the project';
  const tag =
    variant === 'banner'
      ? project.tagline
      : 'See the full case study and related write-ups.';

  const accent: CSSProperties = domain
    ? clusterVars(domain)
    : ({ '--cc': 'var(--info)', '--ct': 'var(--info)' } as CSSProperties);
  const style: CSSProperties = {
    ...accent,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    background: 'color-mix(in srgb, var(--cc) 7%, var(--bg-elevated))',
    border: '1.5px solid color-mix(in srgb, var(--cc) 38%, var(--border))',
    borderLeft: '5px solid var(--cc)',
    borderRadius: 'var(--radius-lg)',
    padding: '18px 22px',
    boxShadow: 'var(--elev-1)',
  };

  return (
    <Link
      href={`/projects/${project.slug}`}
      data-testid="post-project-backlink"
      style={style}
    >
      <span
        aria-hidden="true"
        style={{
          width: 46,
          height: 46,
          flex: 'none',
          borderRadius: 12,
          display: 'grid',
          placeItems: 'center',
          background: 'color-mix(in srgb, var(--cc) 16%, transparent)',
          color: 'var(--ct)',
          fontSize: 20,
        }}
      >
        {domain ? domainGlyph(domain) : '◆'}
      </span>
      <span style={{ flex: 1, minWidth: 180 }}>
        <span
          style={{
            display: 'block',
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--ct)',
            marginBottom: 3,
          }}
        >
          {eyebrow}
        </span>
        <span
          className="font-display"
          style={{
            display: 'block',
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: '-0.01em',
            color: 'var(--text)',
          }}
        >
          {project.name}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 13.5,
            color: 'var(--text-muted)',
            marginTop: 2,
          }}
        >
          {tag}
        </span>
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 44,
          padding: '0 18px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--cc)',
          color: 'var(--text-on-accent)',
          fontWeight: 600,
          fontSize: 14,
          whiteSpace: 'nowrap',
          flex: 'none',
        }}
      >
        View project <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

export default ProjectBacklink;
