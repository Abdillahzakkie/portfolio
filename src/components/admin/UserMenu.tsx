'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from './api';

/** Topbar user menu with a Sign out action (POST /api/auth/logout → login). */
export function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'AZ';

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function onSignOut() {
    setBusy(true);
    try {
      await logout();
    } catch {
      /* even on error we send the user to login */
    }
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] border px-2.5 text-sm font-semibold sm:h-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border-strong)',
          color: 'var(--text)',
        }}
      >
        <span
          aria-hidden="true"
          className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white"
          style={{ background: 'var(--info)' }}
        >
          {initials}
        </span>
        <span className="hidden max-w-[10ch] truncate sm:inline">{name}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-[var(--radius-md)] border py-1 shadow-[var(--elev-2)]"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
        >
          <div
            className="border-b px-3 py-2 text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Signed in as
            <div className="truncate font-semibold" style={{ color: 'var(--text)' }}>
              {name}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            disabled={busy}
            className="flex w-full items-center px-3 py-2.5 text-left text-sm font-medium hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none disabled:opacity-60"
            style={{ color: 'var(--text)' }}
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
