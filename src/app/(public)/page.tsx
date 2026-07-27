import type { ConstellationData } from '@/lib/types';
import { getConstellation } from '@/lib/services';
import { ConstellationHome } from '@/components/public/graph/ConstellationHome';

// Reads the constellation from Mongo. Static prerendering at build time has no
// DB and throws (MongooseServerSelectionError), failing CI. `force-dynamic`
// defers the read to a per-request render — matches `sitemap.ts`/`rss.xml`.
export const dynamic = 'force-dynamic';

/**
 * Graph home `/`. Server-fetches the constellation, then hands it to the
 * progressive-enhancement host. The intro rail is static (RSC) for SEO; the
 * clustered project list (the SSR backbone that satisfies #2/#8 links) and the
 * SVG live inside ConstellationHome.
 */
export default async function HomePage() {
  const data = (await getConstellation()) as ConstellationData;
  const nodes = data?.nodes ?? [];

  return (
    <div
      className="az-home-stage"
      style={{
        maxWidth: 'var(--content-max)',
        margin: '0 auto',
        padding: '32px 16px 24px',
        display: 'grid',
        gap: 32,
        alignItems: 'start',
      }}
    >
      <aside aria-label="Introduction" className="az-home-rail">
        <p
          style={{
            fontSize: 12,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            fontWeight: 600,
            margin: 0,
          }}
        >
          The constellation of work
        </p>
        <h1
          className="font-display"
          style={{
            fontWeight: 700,
            letterSpacing: '-0.02em',
            fontSize: 'clamp(2.25rem, 6vw, 2.75rem)',
            lineHeight: 1.06,
            margin: '10px 0 14px',
          }}
        >
          Abdullah Zakariyya
        </h1>
        <p
          style={{
            fontSize: 18,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            margin: '0 0 8px',
          }}
        >
          Engineer —{' '}
          <b style={{ color: 'var(--text)', fontWeight: 600 }}>Web3</b> ·{' '}
          <b style={{ color: 'var(--text)', fontWeight: 600 }}>Security</b> ·{' '}
          <b style={{ color: 'var(--text)', fontWeight: 600 }}>Commerce</b>
        </p>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: '0 0 22px', maxWidth: '32ch' }}>
          A body of work as a star map. Each star is a project; four constellations, one
          per discipline. Hover, focus, or open one to read its story.
        </p>

        <ul
          aria-hidden="true"
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {(
            [
              ['web3', '◆', 'Web3'],
              ['security', '▲', 'Security'],
              ['commerce', '●', 'Commerce'],
              ['tools', '✦', 'Tools / Labs'],
            ] as const
          ).map(([key, glyph, label]) => (
            <li
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 13,
                color: 'var(--text-muted)',
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background: `var(--cluster-${key}-core)`,
                }}
              />
              <span style={{ color: `var(--cluster-${key}-text)`, fontWeight: 600 }}>
                {glyph} {label}
              </span>
            </li>
          ))}
          <li style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: 'var(--cluster-web3-core)',
                boxShadow: '0 0 8px 2px color-mix(in srgb, var(--cluster-web3-core) 60%, transparent)',
              }}
            />
            Glow = has a published write-up
          </li>
        </ul>
      </aside>

      <div style={{ minWidth: 0 }}>
        <ConstellationHome nodes={nodes} />
      </div>

      <style>{`
        @media (min-width: 1024px){
          .az-home-stage{ grid-template-columns: 280px 1fr; gap: 36px; padding-top: 36px; }
          .az-home-rail{ position: sticky; top: 96px; }
        }
      `}</style>
    </div>
  );
}
