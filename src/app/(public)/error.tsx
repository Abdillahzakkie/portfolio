'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/public/Feedback';

/**
 * Public route error boundary. Renders a plain-language ErrorState (role="alert")
 * with a retry — never a blank screen or a stack trace (docs/03 §8).
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for observability; no sensitive detail is shown to the user.
    console.error(error);
  }, [error]);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '64px 16px' }}>
      <ErrorState
        title="Something went wrong"
        detail="We couldn't load this page. It's not you — please try again."
        action={
          <button
            type="button"
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              padding: '0 18px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--info)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        }
      />
    </div>
  );
}
