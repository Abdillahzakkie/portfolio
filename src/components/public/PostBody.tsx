import type { Domain } from '@/server/models/types';
import { clusterVars } from '@/lib/domain';
import { Markdown } from './Markdown';

interface PostBodyProps {
  /** Markdown/MDX source string (from Post.body / Project.longDescription). */
  source: string;
  /** Domain tints inline links / accents to the matching cluster color. */
  domain?: Domain;
}

/**
 * Prose column for long-form content. Renders sanitized Markdown inside the
 * `.prose` typographic scale (68ch, heading order preserved, code blocks
 * scroll-x internally so they never overflow the page on mobile — #5).
 */
export function PostBody({ source, domain }: PostBodyProps) {
  return (
    <div className="prose" style={domain ? clusterVars(domain) : undefined}>
      <Markdown>{source}</Markdown>
    </div>
  );
}

export default PostBody;
