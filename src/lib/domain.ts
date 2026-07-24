/**
 * Domain presentation helpers shared by public components.
 *
 * IMPORTANT: runtime values (`DOMAIN_LABELS`) are imported from
 * `@/server/models/types` — the runtime-free contract file — NOT the
 * `@/server/models` barrel, so no mongoose is ever pulled into a client bundle.
 */
import type { CSSProperties } from 'react';
import { DOMAIN_LABELS, type Domain } from '@/server/models/types';
import { domainToCluster, CLUSTER_GLYPH } from './graph';

export function domainLabel(domain: Domain): string {
  return DOMAIN_LABELS[domain];
}

/** Non-color glyph for the domain (◆ ▲ ● ✦). */
export function domainGlyph(domain: Domain): string {
  return CLUSTER_GLYPH[domainToCluster(domain)];
}

/**
 * Inline CSS custom properties that scope a subtree to a domain's accent, so
 * components can reference `var(--cc)` (core fill) / `var(--ct)` (text) exactly
 * like the approved mockups do — instead of hard-coding a hex.
 */
export function clusterVars(domain: Domain): CSSProperties {
  const c = domainToCluster(domain);
  return {
    '--cc': `var(--cluster-${c}-core)`,
    '--ct': `var(--cluster-${c}-text)`,
  } as CSSProperties;
}
