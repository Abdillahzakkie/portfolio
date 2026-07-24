'use client';

import type { ProjectNodeData } from '@/lib/types';
import { clusterVars, domainGlyph, domainLabel } from '@/lib/domain';
import { StatusPill } from '../StatusPill';

interface NodePopoverProps {
  id: string;
  node: ProjectNodeData;
  /** Anchor point (px) inside the canvas wrapper — the node centre. */
  left: number;
  top: number;
  /** Flip to the left of the anchor when the node sits in the right half. */
  flip: boolean;
}

/**
 * Accessible node preview. `role="tooltip"`, referenced by the node's
 * aria-describedby; it does NOT trap focus and the node itself remains the link.
 * Placement is collision-aware (flips horizontally near the right edge) and is
 * offset so it never covers the focused node.
 */
export function NodePopover({ id, node, left, top, flip }: NodePopoverProps) {
  const stack = node.stack.slice(0, 3);
  return (
    <div
      id={id}
      role="tooltip"
      style={{
        ...clusterVars(node.domain),
        position: 'absolute',
        left,
        top,
        transform: flip ? 'translate(calc(-100% - 20px), -50%)' : 'translate(20px, -50%)',
        width: 260,
        maxWidth: 'calc(100vw - 40px)',
        zIndex: 8,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--elev-3)',
        padding: '16px 16px 15px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ct)',
          marginBottom: 5,
        }}
      >
        <span aria-hidden="true">{domainGlyph(node.domain)}</span>
        {domainLabel(node.domain)}
      </div>
      <p
        className="font-display"
        style={{
          margin: '0 0 5px',
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: '-0.01em',
          color: 'var(--text)',
        }}
      >
        {node.name}
      </p>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.45,
        }}
      >
        {node.tagline}
      </p>
      {stack.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {stack.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 'var(--radius-full)',
                background: 'color-mix(in srgb, var(--cc) 12%, transparent)',
                color: 'var(--ct)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <StatusPill status={node.hasPublishedPost ? 'published' : 'draft'} size="sm" />
    </div>
  );
}

export default NodePopover;
