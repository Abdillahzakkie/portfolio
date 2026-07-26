'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProjectRow, ProjectRowActionKind } from './types';

/**
 * The per-row `⋯` actions menu for the project table. Structural clone of
 * {@link RowMenu}: keyboard operable, closes on Esc / outside click / action.
 * Projects have NO publish lifecycle, so the only items are Edit and Delete
 * (Delete is marked destructive — the table opens a confirm dialog).
 */
export function ProjectRowMenu({
  row,
  busy,
  onAction,
}: {
  row: ProjectRow;
  busy: boolean;
  onAction: (kind: ProjectRowActionKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        // Return focus to the trigger so it doesn't fall to <body>.
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function run(kind: ProjectRowActionKind) {
    setOpen(false);
    onAction(kind);
  }

  const items: { kind: ProjectRowActionKind; label: string; danger?: boolean }[] = [
    { kind: 'edit', label: 'Edit' },
    { kind: 'delete', label: 'Delete', danger: true },
  ];

  return (
    <div className="relative inline-block text-left" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${row.title}`}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] text-xl leading-none hover:bg-[var(--surface-2)] disabled:opacity-50 sm:h-9 sm:w-9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        style={{ color: 'var(--text-muted)' }}
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
        ) : (
          <span aria-hidden="true">⋯</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${row.title}`}
          className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-[var(--radius-md)] border py-1 shadow-[var(--elev-2)]"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
        >
          {items.map((item, i) => (
            <button
              key={item.kind}
              ref={i === 0 ? firstItemRef : undefined}
              type="button"
              role="menuitem"
              onClick={() => run(item.kind)}
              className="flex w-full items-center px-3 py-2.5 text-left text-sm font-medium hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              style={{ color: item.danger ? 'var(--danger)' : 'var(--text)' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
