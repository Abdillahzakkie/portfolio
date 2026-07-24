import type { CSSProperties, ReactNode } from 'react';

/* Shared loading / empty / error states (docs/03-pages §8, 04-components). */

interface SkeletonProps {
  variant?: 'text' | 'card' | 'avatar' | 'table-row';
  lines?: number;
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: CSSProperties;
}

/** Shape-matched shimmer block (respects reduced-motion via .az-shimmer). */
export function Skeleton({
  variant = 'text',
  lines = 3,
  width,
  height,
  className,
  style,
}: SkeletonProps) {
  const radius =
    variant === 'avatar'
      ? 'var(--radius-full)'
      : variant === 'card'
        ? 'var(--radius-lg)'
        : 'var(--radius-sm)';

  if (variant === 'text') {
    return (
      <div className={className} style={style} aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="az-shimmer"
            style={{
              height: 14,
              borderRadius: radius,
              marginTop: i === 0 ? 0 : 10,
              width: i === lines - 1 ? '70%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`az-shimmer ${className ?? ''}`}
      aria-hidden="true"
      style={{
        width: width ?? '100%',
        height: height ?? (variant === 'avatar' ? 44 : variant === 'table-row' ? 48 : 160),
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

interface EmptyStateProps {
  glyph?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}

/** Empty region — never a blank space. Glyph + one sentence + optional action. */
export function EmptyState({ glyph, title, body, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 10,
        padding: '48px 24px',
        color: 'var(--text-muted)',
      }}
    >
      {glyph && (
        <div aria-hidden="true" style={{ fontSize: 28, color: 'var(--text-faint)' }}>
          {glyph}
        </div>
      )}
      <p
        className="font-display"
        style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}
      >
        {title}
      </p>
      {body && <p style={{ margin: 0, maxWidth: '40ch' }}>{body}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  detail?: string;
  action?: ReactNode;
}

/** Error region with role="alert" (plain-language, no stack traces). */
export function ErrorState({ title, detail, action }: ErrorStateProps) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 10,
        padding: '40px 24px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-elevated)',
        color: 'var(--text-muted)',
      }}
    >
      <p
        className="font-display"
        style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}
      >
        {title}
      </p>
      {detail && <p style={{ margin: 0, maxWidth: '46ch' }}>{detail}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
