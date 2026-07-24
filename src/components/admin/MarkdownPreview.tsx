'use client';

// NOTE (pending integration): frontend-public owns `@/components/public/Markdown`
// (the shared Markdown renderer used by the public blog post page). It is being
// built in parallel and may not exist yet at admin self-check — this is the ONLY
// admin file that consumes it, so the editor's live preview renders identically
// to the published post. See HANDOFF status log.
import { Markdown } from '@/components/public/Markdown';

/** Live Markdown preview for the editor, using the exact public renderer. */
export function MarkdownPreview({ body }: { body: string }) {
  const trimmed = body.trim();
  if (!trimmed) {
    return (
      <p className="text-sm italic" style={{ color: 'var(--text-faint)' }}>
        Nothing to preview yet — start writing in the editor.
      </p>
    );
  }
  return <Markdown>{trimmed}</Markdown>;
}
