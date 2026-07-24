'use client';

import type { ReactNode } from 'react';
import { ImageIcon, LinkIcon } from './icons';

export type EditorCommand =
  | 'bold'
  | 'italic'
  | 'h2'
  | 'quote'
  | 'code'
  | 'hr'
  | 'ul'
  | 'link'
  | 'image';

interface Control {
  cmd: EditorCommand;
  label: string;
  content: ReactNode;
  toggle: boolean;
  className?: string;
}

const CONTROLS: (Control | 'divider')[] = [
  { cmd: 'bold', label: 'Bold', content: 'B', toggle: true, className: 'font-bold' },
  { cmd: 'italic', label: 'Italic', content: 'I', toggle: true, className: 'italic' },
  'divider',
  { cmd: 'h2', label: 'Heading 2', content: 'H2', toggle: true },
  { cmd: 'quote', label: 'Quote', content: '“', toggle: true },
  { cmd: 'code', label: 'Code block', content: '</>', toggle: true, className: 'font-mono text-xs' },
  { cmd: 'ul', label: 'Bulleted list', content: '•', toggle: true },
  { cmd: 'hr', label: 'Horizontal rule', content: '—', toggle: false },
  'divider',
  { cmd: 'image', label: 'Insert image', content: <ImageIcon aria-hidden />, toggle: false },
  { cmd: 'link', label: 'Insert link', content: <LinkIcon aria-hidden />, toggle: false },
];

/**
 * The formatting control surface over the Markdown textarea. Real `<button>`s
 * with `aria-label`; toggle-style marks expose `aria-pressed` reflecting the
 * active state at the caret (computed by the editor). Actions (hr, link, image)
 * are plain buttons.
 */
export function RichTextToolbar({
  onCommand,
  active = {},
}: {
  onCommand: (cmd: EditorCommand) => void;
  active?: Partial<Record<EditorCommand, boolean>>;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="mb-3.5 flex flex-wrap items-center gap-1 rounded-[var(--radius-md)] border p-1.5"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
    >
      {CONTROLS.map((c, i) =>
        c === 'divider' ? (
          <span
            key={`d${i}`}
            aria-hidden="true"
            className="mx-1.5 h-5 w-px"
            style={{ background: 'var(--border-strong)' }}
          />
        ) : (
          <button
            key={c.cmd}
            type="button"
            aria-label={c.label}
            title={c.label}
            aria-pressed={c.toggle ? Boolean(active[c.cmd]) : undefined}
            onClick={() => onCommand(c.cmd)}
            className={`grid h-11 min-w-11 place-items-center rounded-md px-2 text-sm sm:h-9 sm:min-w-9 hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${c.className ?? ''}`}
            style={
              c.toggle && active[c.cmd]
                ? { background: 'var(--bg-elevated)', color: 'var(--info)', boxShadow: 'var(--elev-1)' }
                : { color: 'var(--text)' }
            }
          >
            {c.content}
          </button>
        ),
      )}
    </div>
  );
}
