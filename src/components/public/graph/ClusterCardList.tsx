import type { ProjectNodeData } from '@/lib/types';
import { groupByCluster } from '@/lib/graph';
import { domainLabel } from '@/lib/domain';
import { ProjectCard } from '../ProjectCard';

interface ClusterCardListProps {
  nodes: ProjectNodeData[];
  /** Test hook — the semantic project list / fallback (QA asserts this). */
  'data-testid'?: string;
  id?: string;
  /** Visually hide (but keep in the a11y tree) when the SVG is the visual layer. */
  visuallyHidden?: boolean;
}

/**
 * The grouped-card list. Serves triple duty (concept §5):
 *  1. SSR semantic backbone — a real <nav> of four <section>s, each a <ul> of
 *     <li><a href="/projects/[slug]"> links (satisfies #2/#8 links with no JS).
 *  2. The mobile / coarse-pointer primary experience.
 *  3. The "View as list" fallback at ≥768px.
 * Fluid grid + min-w-0 children → no horizontal overflow at any width (#5).
 */
export function ClusterCardList({
  nodes,
  id,
  visuallyHidden = false,
  'data-testid': testId,
}: ClusterCardListProps) {
  const groups = groupByCluster(nodes);

  return (
    <nav
      id={id}
      data-testid={testId}
      aria-label="All projects by domain"
      className={visuallyHidden ? 'sr-only' : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: 40 }}
    >
      {groups.map((group) => {
        const headingId = `cluster-${group.key}`;
        return (
          <section key={group.key} aria-labelledby={headingId}>
            <h2
              id={headingId}
              className="font-display"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '0 0 16px',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: `var(--cluster-${group.key}-text)`,
              }}
            >
              <span aria-hidden="true">{group.glyph}</span>
              {domainLabel(group.domain)}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-faint)',
                }}
              >
                ({group.nodes.length})
              </span>
            </h2>

            {group.nodes.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                Projects coming soon.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 16,
                }}
              >
                {group.nodes.map((project) => (
                  <li key={project.slug} style={{ minWidth: 0 }}>
                    <ProjectCard project={project} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </nav>
  );
}

export default ClusterCardList;
