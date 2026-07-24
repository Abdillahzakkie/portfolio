import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

/**
 * Admin section frame. Deliberately minimal: it opts the `/admin/*` routes OUT
 * of the public Header (admin renders its own AdminShell per page, and the
 * public chrome lives in the `(public)` route group owned by frontend-public —
 * NOT the root layout). Also marks the whole section noindex.
 *
 * Auth is enforced by backend middleware (`src/middleware.ts`) BEFORE render, so
 * these pages assume a valid session once they run.
 */
export const metadata: Metadata = {
  title: 'Admin · AZ',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0D12' },
  ],
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
