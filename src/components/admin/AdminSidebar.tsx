import Link from 'next/link';
import type { ReactNode } from 'react';
import { PostsIcon, ProjectsIcon, MediaIcon, SettingsIcon } from './icons';

export type NavKey = 'posts' | 'projects' | 'media' | 'settings';

interface NavItem {
  key: NavKey;
  label: string;
  href?: string;
  icon: (p: { className?: string }) => ReactNode;
}

// Only "Posts" is an implemented route in this slice; the others are part of the
// admin IA but out of scope, so they render as disabled (never dead 404 links).
const ITEMS: NavItem[] = [
  { key: 'posts', label: 'Posts', href: '/admin', icon: PostsIcon },
  { key: 'projects', label: 'Projects', icon: ProjectsIcon },
  { key: 'media', label: 'Media', icon: MediaIcon },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

const itemBase =
  'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[14.5px] font-medium min-h-[44px] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]';

export function AdminSidebar({
  activeNav,
  onNavigate,
}: {
  activeNav: NavKey;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col p-3.5" style={{ background: 'var(--bg-elevated)' }}>
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-2.5 pb-5 pt-1.5 text-[19px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
      >
        <span aria-hidden="true" style={{ color: 'var(--info)' }}>
          ◆
        </span>
        AZ
        <span className="text-[15px] font-medium" style={{ color: 'var(--text-faint)' }}>
          · Admin
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5" aria-label="Admin sections">
        {ITEMS.map((item) => {
          const active = item.key === activeNav;
          const Icon = item.icon;
          if (!item.href) {
            return (
              <span
                key={item.key}
                aria-disabled="true"
                title="Coming soon"
                className={`${itemBase} cursor-not-allowed opacity-50`}
                style={{ color: 'var(--text-muted)' }}
              >
                <Icon />
                {item.label}
                <span
                  className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-faint)' }}
                >
                  Soon
                </span>
              </span>
            );
          }
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={itemBase}
              style={
                active
                  ? {
                      background: 'color-mix(in srgb, var(--info) 10%, transparent)',
                      color: 'var(--info)',
                      fontWeight: 600,
                    }
                  : { color: 'var(--text-muted)' }
              }
            >
              <Icon />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-3 py-2.5 text-xs" style={{ color: 'var(--text-faint)' }}>
        Portfolio &amp; blog CMS
      </div>
    </div>
  );
}
