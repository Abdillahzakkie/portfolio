'use client';

import { useEffect } from 'react';
import { Button } from '@/components/admin/Button';

/** Admin-scoped error boundary: plain-language message + retry, no stack trace. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced to the console for local debugging; users never see the details.
    console.error('[admin] render error:', error);
  }, [error]);

  return (
    <main
      className="grid min-h-screen place-items-center p-6"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <div
        role="alert"
        className="w-full max-w-md rounded-[var(--radius-lg)] border p-7 text-center shadow-[var(--elev-2)]"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
      >
        <h1
          className="m-0 mb-2 text-xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
        >
          Something went wrong
        </h1>
        <p className="m-0 mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          We couldn&apos;t load this admin view. Your data is safe — try again.
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button variant="secondary" onClick={() => (window.location.href = '/admin')}>
            Back to posts
          </Button>
        </div>
      </div>
    </main>
  );
}
