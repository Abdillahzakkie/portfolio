import Link from 'next/link';
import { Header } from '@/components/public/Header';
import { Footer } from '@/components/public/Footer';

/** Shared 404 — "Nothing here" + links home and to the blog (docs/03 §8). */
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main">
        <div
          style={{
            maxWidth: 'var(--content-max)',
            margin: '0 auto',
            padding: '80px 16px',
            textAlign: 'center',
          }}
        >
          <p
            aria-hidden="true"
            style={{ fontSize: 40, color: 'var(--text-faint)', margin: '0 0 12px' }}
          >
            ✦
          </p>
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(2rem, 6vw, 2.75rem)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: '0 0 12px',
            }}
          >
            Nothing here
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 28px' }}>
            This page drifted out of orbit. Try one of these instead.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                padding: '0 18px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--info)',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              Back to the constellation
            </Link>
            <Link
              href="/blog"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                padding: '0 18px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontWeight: 600,
              }}
            >
              Read the blog
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
