import Link from 'next/link';
import type { Domain } from '@/server/models/types';
import { clusterVars, domainGlyph, domainLabel } from '@/lib/domain';

interface AtAGlanceProps {
  role?: string;
  timeline?: string;
  domain: Domain;
  /** Kinship / bridge projects as text links — the non-graph equivalent of edges. */
  related: { slug: string; name: string }[];
  links: { repo?: string; live?: string; post?: string };
}

/**
 * Case-study "At a glance" aside. A definition list (role, domain, related
 * projects, links). Sticky on desktop, inline on mobile. "Related" surfaces the
 * graph's kinship/bridge relationships as plain links so keyboard/AT users reach
 * them without the SVG.
 */
export function AtAGlance({ role, timeline, domain, related, links }: AtAGlanceProps) {
  const hasLinks = Boolean(links.repo || links.live || links.post);
  const linkStyle: React.CSSProperties = {
    color: 'var(--ct)',
    fontSize: 14.5,
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
  };

  return (
    <aside
      aria-label="At a glance"
      className="az-aside"
      style={{
        ...clusterVars(domain),
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 22,
        boxShadow: 'var(--elev-1)',
      }}
    >
      <h2
        className="font-display"
        style={{
          margin: '0 0 16px',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        At a glance
      </h2>

      <dl style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: 0 }}>
        {role && (
          <div>
            <dt style={dtStyle}>Role</dt>
            <dd style={ddStyle}>{role}</dd>
          </div>
        )}
        {timeline && (
          <div>
            <dt style={dtStyle}>Timeline</dt>
            <dd style={ddStyle}>{timeline}</dd>
          </div>
        )}
        <div>
          <dt style={dtStyle}>Domain</dt>
          <dd style={ddStyle}>
            <span aria-hidden="true" style={{ color: 'var(--ct)' }}>
              {domainGlyph(domain)}
            </span>{' '}
            {domainLabel(domain)}
          </dd>
        </div>
        {related.length > 0 && (
          <div>
            <dt style={dtStyle}>Related projects</dt>
            <dd style={{ ...ddStyle, marginTop: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {related.map((r) => (
                  <Link key={r.slug} href={`/projects/${r.slug}`} style={linkStyle}>
                    {r.name} <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </dd>
          </div>
        )}
      </dl>

      {hasLinks && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />
          <dl style={{ margin: 0 }}>
            <div>
              <dt style={dtStyle}>Links</dt>
              <dd style={{ ...ddStyle, marginTop: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {links.repo && (
                    <a
                      href={links.repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={linkStyle}
                    >
                      Repository <span aria-hidden="true">↗</span>
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  )}
                  {links.live && (
                    <a
                      href={links.live}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={linkStyle}
                    >
                      Live site <span aria-hidden="true">↗</span>
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  )}
                  {links.post && (
                    <Link href={`/blog/${links.post}`} style={linkStyle}>
                      Read the write-up <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>
              </dd>
            </div>
          </dl>
        </>
      )}

      <style>{`@media (min-width: 1024px){ .az-aside{position:sticky; top:96px;} }`}</style>
    </aside>
  );
}

const dtStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
  fontWeight: 600,
  marginBottom: 4,
};
const ddStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: 'var(--text)',
  fontWeight: 500,
};

export default AtAGlance;
