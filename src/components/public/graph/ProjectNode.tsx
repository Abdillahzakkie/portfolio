'use client';

import type { KeyboardEvent } from 'react';
import type { ProjectNodeData } from '@/lib/types';
import { domainToCluster, nodeRadius, hitRadius } from '@/lib/graph';
import { domainLabel } from '@/lib/domain';

const TIER: Record<1 | 2 | 3, string> = {
  3: 'flagship',
  2: 'core project',
  1: 'supporting project',
};

interface ProjectNodeProps {
  node: ProjectNodeData;
  x: number;
  y: number;
  focused: boolean;
  active: boolean;
  dimmed: boolean;
  reducedMotion: boolean;
  popoverId: string;
  innerRef: (el: SVGGElement | null) => void;
  onActivate: () => void;
  onFocus: () => void;
  onHoverChange: (hovering: boolean) => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

/**
 * A single star. `<g role="link" tabindex>` managed by the roving-tabindex model
 * in Constellation (only the focused node has tabindex 0). Core circle sized by
 * prominence; glow + outer ring iff a companion post is published. Prominence-1
 * labels appear only while active (name stays in aria-label always, so AT never
 * loses it). 44px invisible hit-area for touch/pointer.
 */
export function ProjectNode({
  node,
  x,
  y,
  focused,
  active,
  dimmed,
  reducedMotion,
  popoverId,
  innerRef,
  onActivate,
  onFocus,
  onHoverChange,
  onKeyDown,
}: ProjectNodeProps) {
  const cluster = domainToCluster(node.domain);
  const r = nodeRadius(node.prominence);
  const hitR = hitRadius(node.prominence);
  const core = `var(--cluster-${cluster}-core)`;
  const textColor = `var(--cluster-${cluster}-text)`;
  const published = node.hasPublishedPost;
  const showLabel = node.prominence !== 1 || active;

  const ariaLabel = `${node.name}, ${domainLabel(node.domain)} ${TIER[node.prominence]}, ${
    published ? 'has a published write-up' : 'write-up in progress'
  }`;

  return (
    <g
      ref={innerRef}
      role="link"
      tabIndex={focused ? 0 : -1}
      aria-label={ariaLabel}
      aria-describedby={active ? popoverId : undefined}
      data-slug={node.slug}
      data-href={`/projects/${node.slug}`}
      data-testid={`node-${node.slug}`}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{
        cursor: 'pointer',
        opacity: dimmed ? 0.5 : 1,
        transition: reducedMotion ? 'none' : 'opacity var(--dur-base) var(--ease-standard)',
        outline: 'none',
      }}
    >
      {/* invisible 44px hit target */}
      <circle cx={x} cy={y} r={hitR} fill="transparent" />

      <g
        style={{
          transformBox: 'fill-box',
          transformOrigin: 'center',
          transform: active && !reducedMotion ? 'scale(1.12)' : 'none',
          transition: reducedMotion
            ? 'none'
            : 'transform var(--dur-fast) var(--ease-emphasized)',
        }}
      >
        {published && (
          <circle
            cx={x}
            cy={y}
            r={r + 9}
            fill={core}
            opacity={0.5}
            style={{ filter: 'url(#az-glow)' }}
          />
        )}
        <circle cx={x} cy={y} r={r} fill={core} />
        {published && (
          <circle
            cx={x}
            cy={y}
            r={r + 3.5}
            fill="none"
            stroke={textColor}
            strokeWidth={1.6}
          />
        )}
      </g>

      {focused && (
        <circle
          cx={x}
          cy={y}
          r={r + 9}
          fill="none"
          stroke="var(--ring)"
          strokeWidth={2.5}
        />
      )}

      {showLabel && (
        <text
          x={x}
          y={y + r + 18}
          textAnchor="middle"
          className="az-node-label"
          style={{
            fontFamily: 'var(--font-body, sans-serif)',
            fontWeight: 500,
            fontSize: 15,
            fill: 'var(--text)',
            paintOrder: 'stroke',
            stroke: 'var(--bg-elevated)',
            strokeWidth: 3,
            strokeLinejoin: 'round',
            pointerEvents: 'none',
          }}
        >
          {node.name}
        </text>
      )}
    </g>
  );
}

export default ProjectNode;
