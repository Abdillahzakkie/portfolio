import type { Domain } from '@/server/models/types';
import { clusterVars, domainGlyph, domainLabel } from '@/lib/domain';
import { TagBadge } from './TagBadge';
import { StatusPill } from './StatusPill';
import { Button } from './Button';

interface CaseStudyHeaderProps {
  name: string;
  domain: Domain;
  tagline: string;
  stack: string[];
  links: { repo?: string; live?: string; post?: string };
  status: 'draft' | 'published';
}

/**
 * Case-study header: domain eyebrow + glyph, single H1, tagline lead, wrapped
 * stack TagBadges, and a link row that renders only the links that exist. The
 * StatusPill mirrors whether a companion write-up is published (concept §2).
 */
export function CaseStudyHeader({
  name,
  domain,
  tagline,
  stack,
  links,
  status,
}: CaseStudyHeaderProps) {
  return (
    <header
      style={{
        ...clusterVars(domain),
        padding: '8px 0 26px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 32,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ct)',
          }}
        >
          <span aria-hidden="true">{domainGlyph(domain)}</span>
          {domainLabel(domain)}
        </span>
        <StatusPill status={status} />
      </div>

      <h1
        className="font-display"
        style={{
          margin: '0 0 12px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.08,
          fontSize: 'clamp(2.25rem, 6vw, 3rem)',
          color: 'var(--text)',
        }}
      >
        {name}
      </h1>

      <p
        style={{
          margin: '0 0 20px',
          fontSize: 'clamp(1.05rem, 3vw, 1.25rem)',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          maxWidth: '60ch',
        }}
      >
        {tagline}
      </p>

      {stack.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
          {stack.map((t) => (
            <TagBadge key={t} label={t} domain={domain} size="sm" />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {links.repo && (
          <Button
            as="a"
            href={links.repo}
            external
            variant="secondary"
            iconRight={<ExternalIcon />}
          >
            Repo
          </Button>
        )}
        {links.live && (
          <Button
            as="a"
            href={links.live}
            external
            variant="secondary"
            iconRight={<ExternalIcon />}
          >
            Live
          </Button>
        )}
        {links.post && (
          <Button as="a" href={`/blog/${links.post}`} variant="primary" iconRight={<>→</>}>
            Read the write-up
          </Button>
        )}
      </div>
    </header>
  );
}

function ExternalIcon() {
  return (
    <>
      <span aria-hidden="true" style={{ fontSize: 13, opacity: 0.85 }}>
        ↗
      </span>
      <span className="sr-only">(opens in a new tab)</span>
    </>
  );
}

export default CaseStudyHeader;
