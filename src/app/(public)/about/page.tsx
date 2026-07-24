import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Abdullah Zakariyya — an engineer building across Web3, security, and Nigeria-focused commerce.',
};

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@example.com';
const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL ?? 'https://github.com';

const DISCIPLINES: { key: string; glyph: string; label: string; body: string }[] = [
  {
    key: 'web3',
    glyph: '◆',
    label: 'Web3',
    body: 'Non-custodial settlement, on-chain indexing, NFT tooling and smart contracts — systems where the trust boundary has to stay small and auditable.',
  },
  {
    key: 'security',
    glyph: '▲',
    label: 'Security',
    body: 'Mobile threat defense and forensic artifact matching — reading device signals and checking them against structured threat intelligence.',
  },
  {
    key: 'commerce',
    glyph: '●',
    label: 'Commerce',
    body: 'Nigeria-focused marketplaces on a repeatable Next.js + Mongo/Redis reference architecture I clone and adapt across products.',
  },
  {
    key: 'tools',
    glyph: '✦',
    label: 'Tools / Labs',
    body: 'Productivity tools, marketing sites, and sandboxes for learning — where new stacks and ideas get a first run.',
  },
];

/** About `/about` — bio + disciplines + contact. */
export default function AboutPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 40px' }}>
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
        About
      </p>
      <h1
        className="font-display"
        style={{
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontSize: 'clamp(2rem, 6vw, 2.75rem)',
          lineHeight: 1.1,
          margin: '10px 0 20px',
        }}
      >
        Abdullah Zakariyya
      </h1>

      <div className="prose">
        <p className="lead" style={{ fontSize: 19, color: 'var(--text-muted)' }}>
          I&apos;m an engineer who works across four fairly different disciplines, and I
          like keeping the seams between them clean. Most of what I build shares one
          instinct: make the trust-critical part small, explicit, and easy to reason
          about — then let everything else be downstream of that discipline.
        </p>
        <p>
          The home page is the honest version of this résumé: a star map of real
          projects, grouped by the field they belong to. Bigger stars are the work
          I&apos;ve invested the most in; a glow means there&apos;s a written story behind
          it. Open any project to read the case study, and follow it into the
          companion write-ups.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
          margin: '32px 0',
        }}
      >
        {DISCIPLINES.map((d) => (
          <section
            key={d.key}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 18px 16px',
              boxShadow: 'var(--elev-1)',
            }}
          >
            <h2
              className="font-display"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 18,
                fontWeight: 700,
                margin: '0 0 8px',
                color: `var(--cluster-${d.key}-text)`,
              }}
            >
              <span aria-hidden="true">{d.glyph}</span>
              {d.label}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              {d.body}
            </p>
          </section>
        ))}
      </div>

      <section
        aria-label="Contact"
        style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}
      >
        <h2 className="font-display" style={{ fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
          Get in touch
        </h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a
            href={`mailto:${EMAIL}`}
            style={btnPrimary}
          >
            Email me
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" style={btnSecondary}>
            GitHub ↗
          </a>
          <Link href="/blog" style={btnSecondary}>
            Read the blog →
          </Link>
        </div>
      </section>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  padding: '0 18px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--info)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
};
const btnSecondary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  padding: '0 18px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontWeight: 600,
  fontSize: 14,
};
