import type { CSSProperties } from 'react';
import type { PostStatus } from './types';

type PillStatus = PostStatus | 'scheduled';

const CONFIG: Record<PillStatus, { label: string; accent: string }> = {
  published: { label: 'Published', accent: 'var(--success)' },
  draft: { label: 'Draft', accent: 'var(--warning)' },
  scheduled: { label: 'Scheduled', accent: 'var(--info)' },
};

/**
 * Encodes status by BOTH a colored dot and a text label (never color-only), per
 * tokens.md §2.4 / a11y. Used in the post table and the editor topbar.
 */
export function StatusPill({
  status,
  size = 'sm',
}: {
  status: PillStatus;
  size?: 'sm' | 'md';
}) {
  const { label, accent } = CONFIG[status];
  const style: CSSProperties = {
    color: accent,
    backgroundColor: `color-mix(in srgb, ${accent} 13%, transparent)`,
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-[var(--radius-full)] font-semibold ${
        size === 'md' ? 'px-3 py-1.5 text-[13px]' : 'px-2.5 py-1 text-xs'
      }`}
      style={style}
    >
      <span
        aria-hidden="true"
        className="h-[7px] w-[7px] shrink-0 rounded-full bg-current"
      />
      {label}
    </span>
  );
}
