'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AdminSidebar, type NavKey } from './AdminSidebar';
import { UserMenu } from './UserMenu';
import { MenuIcon, CloseIcon } from './icons';

/**
 * The authenticated admin frame: a persistent sidebar (≥lg) that collapses to a
 * focus-managed drawer on smaller screens, plus a sticky topbar. Distinct from
 * the public Header — admin never renders it. Unauthenticated users never reach
 * this (backend middleware redirects before render).
 *
 * `header` fills the topbar between the mobile menu button and the user menu, so
 * a page can supply its own title/actions (dashboard) or live editor controls
 * (the editor renders this shell itself to share client state).
 */
export function AdminShell({
  activeNav,
  user,
  header,
  children,
  mainClassName = 'p-5 sm:p-6 lg:p-7',
}: {
  activeNav: NavKey;
  user: { name: string };
  header?: ReactNode;
  children: ReactNode;
  mainClassName?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div
      className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      {/* Persistent sidebar (desktop) */}
      <aside
        className="hidden border-r lg:block"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="sticky top-0 h-screen">
          <AdminSidebar activeNav={activeNav} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0"
            style={{ background: 'rgba(10,13,18,.5)' }}
          />
          <div
            role="dialog"
            aria-label="Admin navigation"
            aria-modal="true"
            className="absolute inset-y-0 left-0 w-[260px] max-w-[80%] border-r shadow-[var(--elev-3)]"
            style={{ borderColor: 'var(--border)' }}
          >
            <AdminSidebar activeNav={activeNav} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header
          className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 sm:px-6"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-md)] lg:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            style={{ color: 'var(--text)' }}
          >
            {drawerOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-3">{header}</div>

          <UserMenu name={user.name} />
        </header>

        <main className={`min-w-0 flex-1 ${mainClassName}`}>{children}</main>
      </div>
    </div>
  );
}
