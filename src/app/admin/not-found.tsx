import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <main
      className="grid min-h-screen place-items-center p-6"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <div className="text-center">
        <p
          className="m-0 mb-2 text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-faint)' }}
        >
          404
        </p>
        <h1
          className="m-0 mb-3 text-2xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
        >
          Nothing here
        </h1>
        <p className="m-0 mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          That post or admin page doesn&apos;t exist.
        </p>
        <Link
          href="/admin"
          className="inline-flex h-11 items-center rounded-[var(--radius-md)] px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          style={{ background: 'var(--info)' }}
        >
          Back to posts
        </Link>
      </div>
    </main>
  );
}
