import type { CSSProperties } from 'react';
import type { Domain } from '@/server/models/types';
import { domainToCluster } from '@/lib/graph';

interface TagBadgeProps {
  label: string;
  /** Tints the pill to the domain accent; omit for a neutral pill. */
  domain?: Domain;
  size?: 'xs' | 'sm';
  /** Renders an interactive filter toggle (button) instead of a span. */
  interactive?: boolean;
  active?: boolean;
  onClick?: () => void;
  glyph?: string;
}

function tint(domain?: Domain): CSSProperties {
  if (!domain) {
    return { background: 'var(--surface-2)', color: 'var(--text-muted)' };
  }
  const c = domainToCluster(domain);
  return {
    background: `color-mix(in srgb, var(--cluster-${c}-core) 12%, transparent)`,
    color: `var(--cluster-${c}-text)`,
  };
}

/**
 * Pill tag. Non-interactive = <span>; interactive = <button aria-pressed> filter
 * chip. Encodes domain by tint + optional glyph (never color alone).
 */
export function TagBadge({
  label,
  domain,
  size = 'sm',
  interactive = false,
  active = false,
  onClick,
  glyph,
}: TagBadgeProps) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontWeight: 600,
    fontSize: size === 'xs' ? 11 : 12,
    padding: size === 'xs' ? '3px 9px' : '5px 12px',
    borderRadius: 'var(--radius-full)',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  };

  if (interactive) {
    const activeStyle: CSSProperties = active
      ? { background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)' }
      : {
          background: 'var(--surface)',
          color: 'var(--text-muted)',
          borderColor: 'var(--border-strong)',
        };
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        style={{
          ...base,
          minHeight: 44,
          padding: '8px 16px',
          fontSize: 13.5,
          border: '1px solid',
          cursor: 'pointer',
          ...activeStyle,
        }}
      >
        {glyph && (
          <span aria-hidden="true" style={{ color: active ? 'var(--bg)' : undefined }}>
            {glyph}
          </span>
        )}
        {label}
      </button>
    );
  }

  return (
    <span style={{ ...base, ...tint(domain) }}>
      {glyph && <span aria-hidden="true">{glyph}</span>}
      {label}
    </span>
  );
}

export default TagBadge;
