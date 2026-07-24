'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ProjectNodeData } from '@/lib/types';
import {
  GRAPH_EDGES,
  VIEWBOX,
  positionFor,
  domainToCluster,
  groupByCluster,
  VERTICAL_NEIGHBOUR,
  CLUSTER_ORDER,
  type EdgeData,
  type ClusterKey,
} from '@/lib/graph';
import { domainLabel } from '@/lib/domain';
import { DomainCluster } from './DomainCluster';
import { ProjectNode } from './ProjectNode';
import { NodePopover } from './NodePopover';
import { ZoomControls } from './ZoomControls';

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.5;
const POPOVER_ID = 'constellation-popover';

interface ConstellationProps {
  nodes: ProjectNodeData[];
  edges?: readonly EdgeData[];
  initialFocusSlug?: string;
  onNavigate: (slug: string) => void;
  /** Called when the user presses Esc with no popover open (escape hatch). */
  onExit?: () => void;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The interactive SVG constellation. Owns the roving-tabindex keyboard model
 * (one tab stop, arrows traverse), pan/zoom of a single viewport <g> transform,
 * the accessible node popover, and a polite aria-live region for cluster
 * changes. Mounts only at ≥768px + fine pointer (the parent decides); the SSR
 * <nav> backbone lives beside it. Renders static (no entrance animation) so
 * there is no CLS and reduced-motion is honoured by default.
 */
export function Constellation({
  nodes,
  edges = GRAPH_EDGES,
  initialFocusSlug,
  onNavigate,
  onExit,
}: ConstellationProps) {
  const groups = useMemo(() => groupByCluster(nodes), [nodes]);

  const nodeBySlug = useMemo(() => {
    const m = new Map<string, ProjectNodeData>();
    for (const n of nodes) m.set(n.slug, n);
    return m;
  }, [nodes]);

  const clusterOf = useCallback(
    (slug: string): ClusterKey | null => {
      const n = nodeBySlug.get(slug);
      return n ? domainToCluster(n.domain) : null;
    },
    [nodeBySlug],
  );

  const posOf = useCallback(
    (slug: string) => {
      const c = clusterOf(slug) ?? 'web3';
      return positionFor(slug, c);
    },
    [clusterOf],
  );

  const firstSlug = groups.find((g) => g.nodes.length > 0)?.nodes[0]?.slug ?? null;
  const [focusedSlug, setFocusedSlug] = useState<string | null>(
    initialFocusSlug && nodeBySlug.has(initialFocusSlug) ? initialFocusSlug : firstSlug,
  );
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [announce, setAnnounce] = useState('');

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [panning, setPanning] = useState(false);

  const reducedMotion = useRef(false);
  useEffect(() => {
    reducedMotion.current = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
  }, []);

  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const panState = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const activeSlug = hoveredSlug ?? (keyboardActive ? focusedSlug : null);
  const activeNode = activeSlug ? (nodeBySlug.get(activeSlug) ?? null) : null;
  const activeCluster = activeSlug ? clusterOf(activeSlug) : null;

  // --- Popover placement (measured from the live node rect) -----------------
  const [popover, setPopover] = useState<{ left: number; top: number; flip: boolean } | null>(
    null,
  );
  useLayoutEffect(() => {
    if (!activeSlug) {
      setPopover(null);
      return;
    }
    const el = nodeRefs.current.get(activeSlug);
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const r = el.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    const left = r.left - w.left + r.width / 2;
    const top = r.top - w.top + r.height / 2;
    setPopover({ left, top, flip: left > w.width / 2 });
  }, [activeSlug, scale, tx, ty]);

  // --- Viewport transform helpers -------------------------------------------
  const clampTranslate = useCallback((s: number, nx: number, ny: number) => {
    const spanX = VIEWBOX.width - VIEWBOX.width * s;
    const spanY = VIEWBOX.height - VIEWBOX.height * s;
    const [loX, hiX] = spanX <= 0 ? [spanX, 0] : [0, spanX];
    const [loY, hiY] = spanY <= 0 ? [spanY, 0] : [0, spanY];
    return { x: clamp(nx, loX, hiX), y: clamp(ny, loY, hiY) };
  }, []);

  const centerOn = useCallback(
    (slug: string) => {
      const p = posOf(slug);
      const s = Math.max(scale, 1);
      const nt = clampTranslate(s, VIEWBOX.width / 2 - s * p.x, VIEWBOX.height / 2 - s * p.y);
      setScale(s);
      setTx(nt.x);
      setTy(nt.y);
    },
    [posOf, scale, clampTranslate],
  );

  const zoomAbout = useCallback(
    (vx: number, vy: number, factor: number) => {
      setScale((s) => {
        const ns = clamp(s * factor, MIN_SCALE, MAX_SCALE);
        const wx = (vx - tx) / s;
        const wy = (vy - ty) / s;
        const nt = clampTranslate(ns, vx - wx * ns, vy - wy * ns);
        setTx(nt.x);
        setTy(nt.y);
        return ns;
      });
    },
    [tx, ty, clampTranslate],
  );

  const zoomIn = useCallback(
    () => zoomAbout(VIEWBOX.width / 2, VIEWBOX.height / 2, 1.25),
    [zoomAbout],
  );
  const zoomOut = useCallback(
    () => zoomAbout(VIEWBOX.width / 2, VIEWBOX.height / 2, 0.8),
    [zoomAbout],
  );
  const fit = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  // --- Wheel zoom (about cursor) --------------------------------------------
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const f = rect.width / VIEWBOX.width || 1;
      const vx = (e.clientX - rect.left) / f;
      const vy = (e.clientY - rect.top) / f;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      // Only intercept scroll while zooming within bounds; otherwise let page scroll.
      const ns = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
      if (ns !== scale) {
        e.preventDefault();
        zoomAbout(vx, vy, factor);
      }
    },
    [scale, zoomAbout],
  );

  // --- Pan (drag on empty sky) ----------------------------------------------
  const onBgPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!(e.target as HTMLElement).dataset?.bg) return;
      panState.current = { x: e.clientX, y: e.clientY, tx, ty };
      setPanning(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [tx, ty],
  );
  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const ps = panState.current;
      const wrap = wrapRef.current;
      if (!ps || !wrap) return;
      const f = wrap.getBoundingClientRect().width / VIEWBOX.width || 1;
      const dx = (e.clientX - ps.x) / f;
      const dy = (e.clientY - ps.y) / f;
      const nt = clampTranslate(scale, ps.tx + dx, ps.ty + dy);
      setTx(nt.x);
      setTy(nt.y);
    },
    [scale, clampTranslate],
  );
  const endPan = useCallback(() => {
    panState.current = null;
    setPanning(false);
  }, []);

  // --- Keyboard (roving tabindex) -------------------------------------------
  const registerRef = useCallback(
    (slug: string) => (el: SVGGElement | null) => {
      if (el) nodeRefs.current.set(slug, el);
      else nodeRefs.current.delete(slug);
    },
    [],
  );

  const moveFocus = useCallback(
    (slug: string, fromCluster: ClusterKey | null) => {
      setFocusedSlug(slug);
      setKeyboardActive(true);
      const toCluster = clusterOf(slug);
      if (toCluster && toCluster !== fromCluster) {
        const g = groups.find((gr) => gr.key === toCluster);
        if (g) setAnnounce(`Entered ${domainLabel(g.domain)}, ${g.nodes.length} projects`);
      }
      // focus + center (works even before re-render since tabindex -1 is focusable)
      requestAnimationFrame(() => nodeRefs.current.get(slug)?.focus());
      centerOn(slug);
    },
    [clusterOf, groups, centerOn],
  );

  const nearestInCluster = useCallback(
    (fromSlug: string, targetCluster: ClusterKey): string | null => {
      const g = groups.find((gr) => gr.key === targetCluster);
      if (!g || g.nodes.length === 0) return null;
      const p = posOf(fromSlug);
      let best = g.nodes[0].slug;
      let bestD = Infinity;
      for (const n of g.nodes) {
        const q = posOf(n.slug);
        const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = n.slug;
        }
      }
      return best;
    },
    [groups, posOf],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (!focusedSlug) return;
      const cluster = clusterOf(focusedSlug);
      const group = groups.find((g) => g.key === cluster);
      if (!group) return;
      const idx = group.nodes.findIndex((n) => n.slug === focusedSlug);
      const len = group.nodes.length;

      const go = (slug: string | null | undefined) => {
        if (!slug) return;
        e.preventDefault();
        moveFocus(slug, cluster);
      };

      switch (e.key) {
        case 'ArrowRight':
          go(group.nodes[(idx + 1) % len]?.slug);
          break;
        case 'ArrowLeft':
          go(group.nodes[(idx - 1 + len) % len]?.slug);
          break;
        case 'ArrowDown':
        case 'ArrowUp': {
          const target = cluster ? VERTICAL_NEIGHBOUR[cluster] : null;
          if (target) go(nearestInCluster(focusedSlug, target));
          break;
        }
        case 'Home':
          go(group.nodes[0]?.slug);
          break;
        case 'End':
          go(group.nodes[len - 1]?.slug);
          break;
        case 'PageDown':
        case 'PageUp': {
          const order = CLUSTER_ORDER;
          const ci = cluster ? order.indexOf(cluster) : 0;
          const dir = e.key === 'PageDown' ? 1 : -1;
          for (let step = 1; step <= order.length; step++) {
            const g = groups.find(
              (gr) => gr.key === order[(ci + dir * step + order.length) % order.length],
            );
            if (g && g.nodes.length > 0) {
              go(g.nodes[0].slug);
              break;
            }
          }
          break;
        }
        case 'Enter':
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          onNavigate(focusedSlug);
          break;
        case 'Escape':
          if (hoveredSlug) {
            setHoveredSlug(null);
          } else {
            onExit?.();
          }
          break;
        default:
      }
    },
    [
      focusedSlug,
      clusterOf,
      groups,
      moveFocus,
      nearestInCluster,
      onNavigate,
      hoveredSlug,
      onExit,
    ],
  );

  const onContainerBlur = useCallback((e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setKeyboardActive(false);
    }
  }, []);

  const transition =
    panning || reducedMotion.current
      ? 'none'
      : 'transform var(--dur-slow) var(--ease-standard)';

  return (
    <div
      ref={wrapRef}
      data-testid="constellation"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        aspectRatio: `${VIEWBOX.width} / ${VIEWBOX.height}`,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-elevated)',
        overflow: 'hidden',
        boxShadow: 'var(--elev-1)',
        touchAction: 'none',
      }}
    >
      <ZoomControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFit={fit}
        scale={scale}
        min={MIN_SCALE}
        max={MAX_SCALE}
      />

      <section
        role="application"
        aria-roledescription="Interactive project constellation"
        aria-label="Projects, grouped by domain"
        onKeyDown={handleKeyDown}
        onBlur={onContainerBlur}
        style={{ position: 'absolute', inset: 0 }}
      >
        <p id="graph-help" className="sr-only">
          Use arrow keys to move between projects. Left and right move within a domain;
          up and down jump between domains. Press Enter to open a project. Press Tab to
          leave the graph. A list of all projects follows.
        </p>
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>

        <svg
          viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-describedby="graph-help"
          aria-label={`Constellation of ${nodes.length} projects in four domain clusters`}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: panning ? 'grabbing' : 'grab',
          }}
          onWheel={onWheel}
          onPointerDown={onBgPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerLeave={endPan}
        >
          <defs>
            <pattern id="az-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1.4" cy="1.4" r="1.1" fill="var(--border)" opacity="0.55" />
            </pattern>
            <radialGradient id="az-vig" cx="50%" cy="46%" r="72%">
              <stop offset="58%" stopColor="var(--bg-elevated)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--bg-elevated)" stopOpacity="0.85" />
            </radialGradient>
            <filter id="az-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="20" />
            </filter>
            <filter id="az-glow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>

          {/* background sky (drag target) */}
          <rect
            data-bg="1"
            x={0}
            y={0}
            width={VIEWBOX.width}
            height={VIEWBOX.height}
            fill="url(#az-dots)"
          />

          <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transition }}>
            {/* edges (behind everything, decorative → aria-hidden) */}
            <g aria-hidden="true">
              {edges.map((ed, i) => {
                const a = posOf(ed.from);
                const b = posOf(ed.to);
                const incident = ed.from === activeSlug || ed.to === activeSlug;
                const stroke = incident
                  ? `var(--cluster-${activeCluster}-core)`
                  : ed.kind === 'kinship'
                    ? 'var(--border-strong)'
                    : 'var(--text-faint)';
                const opacity = incident ? 0.72 : ed.kind === 'kinship' ? 0.55 : 0.45;
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={stroke}
                    strokeWidth={incident ? 2 : 1.6}
                    strokeDasharray={ed.kind === 'bridge' ? '5 5' : undefined}
                    opacity={opacity}
                    style={{ transition: 'opacity var(--dur-fast), stroke var(--dur-fast)' }}
                  />
                );
              })}
            </g>

            {/* clusters + nodes */}
            {groups.map((group) => (
              <DomainCluster
                key={group.key}
                clusterKey={group.key}
                label={domainLabel(group.domain)}
                count={group.nodes.length}
                glyph={group.glyph}
                dimmed={Boolean(activeCluster) && activeCluster !== group.key}
              >
                {group.nodes.map((node) => {
                  const p = posOf(node.slug);
                  return (
                    <ProjectNode
                      key={node.slug}
                      node={node}
                      x={p.x}
                      y={p.y}
                      focused={node.slug === focusedSlug}
                      active={node.slug === activeSlug}
                      dimmed={false}
                      reducedMotion={reducedMotion.current}
                      popoverId={POPOVER_ID}
                      innerRef={registerRef(node.slug)}
                      onActivate={() => onNavigate(node.slug)}
                      onFocus={() => {
                        setFocusedSlug(node.slug);
                        setKeyboardActive(true);
                      }}
                      onHoverChange={(h) => setHoveredSlug(h ? node.slug : null)}
                      onKeyDown={handleKeyDown}
                    />
                  );
                })}
              </DomainCluster>
            ))}
          </g>

          {/* vignette overlay */}
          <rect
            x={0}
            y={0}
            width={VIEWBOX.width}
            height={VIEWBOX.height}
            fill="url(#az-vig)"
            pointerEvents="none"
          />
        </svg>

        {activeNode && popover && (
          <NodePopover
            id={POPOVER_ID}
            node={activeNode}
            left={popover.left}
            top={popover.top}
            flip={popover.flip}
          />
        )}
      </section>
    </div>
  );
}

export default Constellation;
