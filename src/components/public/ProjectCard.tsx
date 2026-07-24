import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { ProjectNodeData } from '@/lib/types';
import { clusterVars, domainGlyph, domainLabel } from '@/lib/domain';
import { TagBadge } from './TagBadge';

interface ProjectCardProps {
  project: Pick<
    ProjectNodeData,
    'slug' | 'name' | 'domain' | 'tagline' | 'stack' | 'hasPublishedPost'
  >;
  size?: 'sm' | 'md';
}

/**
 * Project card — the non-graph equivalent of a constellation node (mobile /
 * fallback / "view as list"). The whole card is a single link; nested tags are
 * NOT interactive here (avoids a nested-interactive a11y violation).
 */
export function ProjectCard({ project, size = 'md' }: ProjectCardProps) {
  const { slug, name, domain, tagline, stack, hasPublishedPost } = project;
  const shownStack = stack.slice(0, 3);
  const overflow = stack.length - shownStack.length;

  const style: CSSProperties = {
    ...clusterVars(domain),
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: size === 'sm' ? '16px 16px 14px 20px' : '18px 18px 16px 22px',
    boxShadow: 'var(--elev-1)',
    overflow: 'hidden',
    height: '100%',
  };

  return (
    <Link href={`/projects/${slug}`} style={style} className="az-card">
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
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ct)',
          }}
        >
          <span aria-hidden="true">{domainGlyph(domain)}</span>
          {domainLabel(domain)}
        </span>
        {hasPublishedPost && (
          <span
            title="Has a published write-up"
            aria-label="Has a published write-up"
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--cc)',
              boxShadow: '0 0 8px 2px color-mix(in srgb, var(--cc) 60%, transparent)',
              flex: 'none',
            }}
          />
        )}
      </div>
      <h3
        className="font-display"
        style={{
          margin: '0 0 6px',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          lineHeight: 1.25,
          color: 'var(--text)',
        }}
      >
        {name}
      </h3>
      <p
        style={{
          margin: '0 0 14px',
          fontSize: 14,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          flex: 1,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {tagline}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {shownStack.map((t) => (
          <TagBadge key={t} label={t} domain={domain} size="xs" />
        ))}
        {overflow > 0 && <TagBadge label={`+${overflow}`} size="xs" />}
      </div>
      <style>{`.az-card{transition:box-shadow var(--dur-fast) var(--ease-standard), transform var(--dur-fast);}
        .az-card:hover{box-shadow:var(--elev-2); transform:translateY(-2px);}`}</style>
    </Link>
  );
}

export default ProjectCard;
