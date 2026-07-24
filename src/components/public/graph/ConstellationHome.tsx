'use client';

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectNodeData } from '@/lib/types';
import { Constellation } from './Constellation';
import { ClusterCardList } from './ClusterCardList';

/* Error boundary: if the SVG graph throws, quietly show the card list instead —
   the graph failing must never block reaching a project (docs/02 §8). */
class GraphErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <>
          <p role="alert" className="sr-only">
            Showing the list view.
          </p>
          {this.props.fallback}
        </>
      );
    }
    return this.props.children;
  }
}

interface ConstellationHomeProps {
  nodes: ProjectNodeData[];
  initialFocusSlug?: string;
}

/**
 * Progressive-enhancement host for the graph home (concept §5).
 *  - SSR / no-JS / <768px / coarse pointer → the ClusterCardList (real <nav> of
 *    links) is the visible experience. This alone satisfies #2/#8 links.
 *  - ≥768px + fine pointer after mount → the SVG Constellation mounts; the card
 *    list stays in the DOM (sr-only) as the semantic backbone, and a persistent
 *    "View as list" toggle lets any user opt back into the cards.
 */
export function ConstellationHome({ nodes, initialFocusSlug }: ConstellationHomeProps) {
  const router = useRouter();
  const [canGraph, setCanGraph] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [forceList, setForceList] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(min-width: 768px) and (pointer: fine)');
    const update = () => setCanGraph(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const navigate = useCallback(
    (slug: string) => router.push(`/projects/${slug}`),
    [router],
  );

  const showGraph = mounted && canGraph && !forceList;

  return (
    <div style={{ position: 'relative' }}>
      {showGraph ? (
        <>
          <GraphErrorBoundary
            fallback={<ClusterCardList nodes={nodes} data-testid="project-list" />}
          >
            <Constellation
              nodes={nodes}
              initialFocusSlug={initialFocusSlug}
              onNavigate={navigate}
              onExit={() => toggleRef.current?.focus()}
            />
          </GraphErrorBoundary>
          {/* semantic backbone kept in the a11y tree while the SVG is visual */}
          <ClusterCardList nodes={nodes} data-testid="project-list" visuallyHidden />
        </>
      ) : (
        <ClusterCardList nodes={nodes} data-testid="project-list" />
      )}

      {mounted && canGraph && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setForceList((v) => !v)}
            aria-pressed={forceList}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 44,
              padding: '0 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
            {forceList ? 'View as constellation' : 'View as list'}
          </button>
        </div>
      )}
    </div>
  );
}

export default ConstellationHome;
