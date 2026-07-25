/**
 * Static graph geometry + relationships for the constellation home.
 *
 * OWNERSHIP: node POSITIONS and EDGES are the frontend's static contract (per the
 * team SHARED CONTRACT v1). The backend owns the project/post *data*
 * (`ProjectNodeData`), but where each star sits and which stars are joined is
 * fixed design intent that must be deterministic so Playwright can assert #8.
 *
 * Coordinate space: viewBox `0 0 1280 860` (see docs/design/02-graph-home.md §1.1).
 * Cluster anchors are the four quadrant centroids; NODE_POSITIONS were computed
 * once via sunflower/phyllotaxis (angle = i·137.5°, r = k·√i, k = 62) around each
 * anchor, then relaxed so no two nodes' *label boxes* (not just circles) overlap,
 * then FROZEN here. Do not recompute at runtime — these exact values are the
 * contract Playwright asserts (#8).
 */

import type { Domain } from '@/server/models';
import type { ProjectNodeData } from './types';

/** Visual cluster key. Mirrors `Domain` but collapses `tools-labs` → `tools` to
 *  match the CSS custom-property names (`--cluster-tools-*`) and glyph set. */
export type ClusterKey = 'web3' | 'security' | 'commerce' | 'tools';

export const VIEWBOX = { width: 1280, height: 860 } as const;

/** Map the data-model domain onto the visual cluster key. */
export function domainToCluster(domain: Domain): ClusterKey {
  return domain === 'tools-labs' ? 'tools' : domain;
}

/** Per-domain non-color glyph (colorblind + AT safety — tokens §2.3). */
export const CLUSTER_GLYPH: Record<ClusterKey, string> = {
  web3: '◆',
  security: '▲',
  commerce: '●',
  tools: '✦',
};

/** Four cluster anchors (centroids) in viewBox units — docs 02 §1.1. Pushed
 *  toward the corners (≈620px apart horizontally, ≈360px vertically) so the four
 *  clusters read as clearly separate constellations. */
export const CLUSTER_ANCHORS: Record<ClusterKey, { x: number; y: number }> = {
  web3: { x: 330, y: 250 },
  security: { x: 950, y: 250 },
  commerce: { x: 330, y: 610 },
  tools: { x: 950, y: 610 },
};

/** Corner label placements (glyph + name sit outside each halo, toward a corner). */
export const CLUSTER_LABEL_POS: Record<
  ClusterKey,
  { x: number; y: number; anchor: 'start' | 'end' }
> = {
  web3: { x: 150, y: 115, anchor: 'start' },
  security: { x: 1130, y: 115, anchor: 'end' },
  commerce: { x: 150, y: 815, anchor: 'start' },
  tools: { x: 1130, y: 815, anchor: 'end' },
};

/** Visible node radius by prominence (viewBox units) — docs 02 §1.1. */
export function nodeRadius(prominence: 1 | 2 | 3): number {
  return prominence === 3 ? 26 : prominence === 2 ? 19 : 13;
}

/** Invisible hit-area radius: guarantees the 44px touch target after scaling. */
export function hitRadius(prominence: 1 | 2 | 3): number {
  return Math.max(nodeRadius(prominence), 22);
}

/**
 * FROZEN node positions (viewBox units). Computed via phyllotaxis (k = 62) + AABB
 * relaxation against each node's *label box* (name width + a 22px label height
 * below the circle, min gap 8), rounded to 0.1. Zero residual label-box overlaps
 * AND zero circle overlaps at the default fit; all coords sit inside the viewBox
 * `0 0 1280 860` with margin (box bounds ≈ x[130,1005] y[112,718]). Keyed by slug.
 */
export const NODE_POSITIONS: Readonly<Record<string, { x: number; y: number }>> =
  Object.freeze({
    // Web3 (top-left)
    settleo: { x: 275.5, y: 297.2 },
    'nftmixer-go': { x: 336.8, y: 212.1 },
    'gkoi-platform': { x: 384.5, y: 293.5 },
    'gkoi-contracts': { x: 330, y: 131.4 },
    'settleo-escrow': { x: 198.5, y: 218.1 },
    'nftmixer-net': { x: 330, y: 372.2 },
    'gkoi-apps': { x: 454.7, y: 225.5 },
    // Security (top-right)
    sentova: { x: 950, y: 209.5 },
    'sentova-mtd': { x: 950, y: 290.5 },
    // Commerce (bottom-left)
    managerenta: { x: 330, y: 523.4 },
    chekka: { x: 331.1, y: 596.7 },
    'golden-bite': { x: 280, y: 670.2 },
    prechop: { x: 408.9, y: 602.8 },
    adverta: { x: 380.1, y: 664.8 },
    mogadget: { x: 250, y: 602.2 },
    // Tools / Labs (bottom-right)
    aisolver: { x: 950, y: 610.3 },
    fivestick: { x: 950, y: 677.3 },
    labs: { x: 950, y: 542.3 },
  });

/** Fallback position for any slug not in the frozen map (unseeded/new project).
 *  Places it on its cluster anchor so the graph never throws on unknown data. */
export function positionFor(
  slug: string,
  cluster: ClusterKey,
): { x: number; y: number } {
  return NODE_POSITIONS[slug] ?? CLUSTER_ANCHORS[cluster];
}

// ---------------------------------------------------------------------------
// Edges (the only 10 relationships drawn) — docs/design/00-concept.md §4.
// aria-hidden decoration; every relationship is also stated in prose on the
// destination case study, so AT loses no information.
// ---------------------------------------------------------------------------

export interface EdgeData {
  from: string;
  to: string;
  kind: 'kinship' | 'bridge';
}

export const GRAPH_EDGES: readonly EdgeData[] = Object.freeze([
  { from: 'nftmixer-net', to: 'nftmixer-go', kind: 'kinship' },
  { from: 'managerenta', to: 'golden-bite', kind: 'kinship' },
  { from: 'managerenta', to: 'chekka', kind: 'kinship' },
  { from: 'managerenta', to: 'mogadget', kind: 'kinship' },
  { from: 'gkoi-platform', to: 'gkoi-apps', kind: 'kinship' },
  { from: 'gkoi-platform', to: 'gkoi-contracts', kind: 'kinship' },
  { from: 'settleo', to: 'settleo-escrow', kind: 'kinship' },
  { from: 'sentova', to: 'sentova-mtd', kind: 'kinship' },
  { from: 'settleo', to: 'gkoi-contracts', kind: 'bridge' },
  { from: 'sentova', to: 'settleo', kind: 'bridge' },
] satisfies EdgeData[]);

/** Cluster reading order (top-left → top-right → bottom-left → bottom-right). */
export const CLUSTER_ORDER: readonly ClusterKey[] = [
  'web3',
  'security',
  'commerce',
  'tools',
];

/** Reverse of `domainToCluster` — the canonical domain for each cluster key. */
export const CLUSTER_TO_DOMAIN: Record<ClusterKey, Domain> = {
  web3: 'web3',
  security: 'security',
  commerce: 'commerce',
  tools: 'tools-labs',
};

export interface ClusterGroup {
  key: ClusterKey;
  domain: Domain;
  glyph: string;
  nodes: ProjectNodeData[];
}

/**
 * Group nodes into the four clusters in reading order, each sorted by prominence
 * desc then name. Empty clusters are kept (so labels/headings always render — the
 * "data empty" state in docs/02 §8). Shared by the SVG and the card fallback.
 */
export function groupByCluster(nodes: ProjectNodeData[]): ClusterGroup[] {
  return CLUSTER_ORDER.map((key) => {
    const inCluster = nodes
      .filter((n) => domainToCluster(n.domain) === key)
      .sort((a, b) => b.prominence - a.prominence || a.name.localeCompare(b.name));
    return {
      key,
      domain: CLUSTER_TO_DOMAIN[key],
      glyph: CLUSTER_GLYPH[key],
      nodes: inCluster,
    };
  });
}

/** The cluster directly above/below a given one (left column: web3↔commerce;
 *  right column: security↔tools) — powers ↑/↓ arrow traversal (docs 02 §6.3). */
export const VERTICAL_NEIGHBOUR: Record<ClusterKey, ClusterKey> = {
  web3: 'commerce',
  commerce: 'web3',
  security: 'tools',
  tools: 'security',
};
