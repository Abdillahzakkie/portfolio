'use client';

import type { ReactNode } from 'react';
import type { ClusterKey } from '@/lib/graph';
import { CLUSTER_ANCHORS, CLUSTER_LABEL_POS } from '@/lib/graph';

interface DomainClusterProps {
  clusterKey: ClusterKey;
  label: string;
  count: number;
  glyph: string;
  dimmed: boolean;
  /** The ProjectNode elements for this cluster. */
  children: ReactNode;
}

/**
 * A constellation group: nebula halo + text cluster label (glyph + name + count)
 * + its child nodes. `role="group"` with an aria-label so AT announces the
 * cluster. The label is real text (never decoration-only) — tokens §2.3.
 */
export function DomainCluster({
  clusterKey,
  label,
  count,
  glyph,
  dimmed,
  children,
}: DomainClusterProps) {
  const anchor = CLUSTER_ANCHORS[clusterKey];
  const lbl = CLUSTER_LABEL_POS[clusterKey];
  const core = `var(--cluster-${clusterKey}-core)`;
  const textColor = `var(--cluster-${clusterKey}-text)`;

  return (
    <g
      role="group"
      aria-label={`${label} — ${count} project${count === 1 ? '' : 's'}`}
      style={{
        opacity: dimmed ? 0.55 : 1,
        transition: 'opacity var(--dur-base) var(--ease-standard)',
      }}
    >
      {/* nebula halo */}
      <circle
        cx={anchor.x}
        cy={anchor.y}
        r={132}
        fill={core}
        opacity={0.08}
        style={{ filter: 'url(#az-soft)' }}
        aria-hidden="true"
      />
      {/* cluster label */}
      <text
        x={lbl.x}
        y={lbl.y}
        textAnchor={lbl.anchor}
        className="font-display"
        style={{ fontWeight: 700, fontSize: 22, fill: textColor }}
      >
        {glyph}
        {'  '}
        {label}
      </text>
      <text
        x={lbl.x}
        y={lbl.y + 18}
        textAnchor={lbl.anchor}
        style={{ fontWeight: 500, fontSize: 12.5, fill: 'var(--text-faint)' }}
      >
        {count} project{count === 1 ? '' : 's'}
      </text>
      {children}
    </g>
  );
}

export default DomainCluster;
