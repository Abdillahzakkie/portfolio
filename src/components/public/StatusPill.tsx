import type { CSSProperties } from 'react';

interface StatusPillProps {
  status: 'draft' | 'published' | 'scheduled';
  size?: 'sm' | 'md';
}

const CONFIG: Record<StatusPillProps['status'], { token: string; label: string }> = {
  published: { token: '--success', label: 'Published' },
  draft: { token: '--warning', label: 'Draft' },
  scheduled: { token: '--info', label: 'Scheduled' },
};

/**
 * Status pill — encodes state by a colored dot + text label (never color alone,
 * for a11y). Used in the case-study header, node popover, and admin table.
 */
export function StatusPill({ status, size = 'md' }: StatusPillProps) {
  const { token, label } = CONFIG[status];
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    fontWeight: 600,
    fontSize: size === 'sm' ? 12 : 12.5,
    padding: size === 'sm' ? '4px 10px' : '5px 12px',
    borderRadius: 'var(--radius-full)',
    background: `color-mix(in srgb, var(${token}) 12%, transparent)`,
    color: `var(${token})`,
    lineHeight: 1.2,
  };
  return (
    <span style={style}>
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: `var(${token})`,
        }}
      />
      {label}
    </span>
  );
}

export default StatusPill;
