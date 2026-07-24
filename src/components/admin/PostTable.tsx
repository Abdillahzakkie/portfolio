'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { FilterKey, PostRow, RowActionKind } from './types';
import { StatusPill } from './StatusPill';
import { RowMenu } from './RowMenu';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from './Button';
import { ToastRegion, useToast } from './Toast';
import { SearchIcon, PlusIcon } from './icons';
import { publishPost, unpublishPost, deletePost, type ApiError } from './api';

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'drafts', label: 'Drafts' },
];

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PostTable({ initialPosts }: { initialPosts: PostRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<PostRow[]>(initialPosts);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<PostRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast, show, clear } = useToast();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'published' && r.status !== 'published') return false;
      if (filter === 'drafts' && r.status !== 'draft') return false;
      if (q && !`${r.title} ${r.projectName ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, query]);

  async function togglePublish(row: PostRow, target: 'published' | 'draft') {
    // Optimistic flip, rollback on failure.
    const prev = rows;
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: target,
              publishedAt: target === 'published' ? new Date().toISOString() : null,
              updatedAt: new Date().toISOString(),
            }
          : r,
      ),
    );
    setBusyId(row.id);
    try {
      if (target === 'published') await publishPost(row.id);
      else await unpublishPost(row.id);
      show('success', target === 'published' ? 'Post published.' : 'Post moved to draft.');
      router.refresh();
    } catch (err) {
      setRows(prev); // rollback
      const status = (err as ApiError).status;
      show('error', status === 401 ? 'Session expired — please sign in again.' : "Couldn't update the post. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmDelete() {
    if (!toDelete) return;
    const row = toDelete;
    setDeleting(true);
    try {
      await deletePost(row.id);
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      show('success', 'Post deleted.');
      setToDelete(null);
      router.refresh();
    } catch {
      show('error', "Couldn't delete the post. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  function onRowAction(row: PostRow, kind: RowActionKind) {
    switch (kind) {
      case 'edit':
        router.push(`/admin/posts/${row.id}`);
        break;
      case 'publish':
        void togglePublish(row, 'published');
        break;
      case 'unpublish':
        void togglePublish(row, 'draft');
        break;
      case 'delete':
        setToDelete(row);
        break;
    }
  }

  const noPostsAtAll = rows.length === 0;

  return (
    <div>
      {/* Toolbar: filter tabs + search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter posts"
          className="inline-flex gap-1 rounded-[var(--radius-md)] p-1"
          style={{ background: 'var(--surface-2)' }}
        >
          {TABS.map((tab) => {
            const selected = filter === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => setFilter(tab.key)}
                className="rounded-lg px-4 py-2 text-[13.5px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                style={
                  selected
                    ? {
                        background: 'var(--bg-elevated)',
                        color: 'var(--text)',
                        boxShadow: 'var(--elev-1)',
                      }
                    : { color: 'var(--text-muted)' }
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <label
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border px-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)' }}
        >
          <SearchIcon aria-hidden />
          <span className="sr-only">Search posts</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts…"
            aria-label="Search posts"
            className="w-40 bg-transparent text-sm outline-none sm:w-56"
            style={{ color: 'var(--text)' }}
          />
        </label>
      </div>

      <div data-testid="post-table">
        {noPostsAtAll ? (
          <EmptyState
            title="No posts yet"
            body="Create your first post to start building the blog."
            action={
              <Button
                variant="primary"
                iconLeft={<PlusIcon aria-hidden />}
                onClick={() => router.push('/admin/posts/new')}
              >
                Create your first post
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              filter === 'published'
                ? 'No published posts'
                : filter === 'drafts'
                  ? 'No drafts'
                  : 'No matching posts'
            }
            body="Try a different filter or search term."
          />
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div
              className="hidden overflow-hidden rounded-[var(--radius-lg)] border shadow-[var(--elev-1)] md:block"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['Title', 'Project', 'Status', 'Updated'].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-5 py-3.5 text-left text-[11.5px] font-bold uppercase tracking-wider"
                        style={{
                          color: 'var(--text-faint)',
                          background: 'var(--surface-2)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                    <th scope="col" className="w-px px-5 py-3.5" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id} className="hover:bg-[var(--surface-2)]">
                      <td className="px-5 py-4 align-middle" style={{ borderBottom: '1px solid var(--border)' }}>
                        <Link
                          href={`/admin/posts/${row.id}`}
                          className="font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                          style={{ color: 'var(--text)' }}
                        >
                          {row.title || 'Untitled'}
                        </Link>
                      </td>
                      <td className="px-5 py-4 align-middle text-[13.5px]" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                        {row.projectName ?? '—'}
                      </td>
                      <td className="w-px whitespace-nowrap px-5 py-4 align-middle" style={{ borderBottom: '1px solid var(--border)' }}>
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-5 py-4 align-middle text-[13.5px]" style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }}>
                        {formatRelative(row.updatedAt)}
                      </td>
                      <td className="w-px whitespace-nowrap px-3 py-4 text-right align-middle" style={{ borderBottom: '1px solid var(--border)' }}>
                        <RowMenu row={row} busy={busyId === row.id} onAction={(k) => onRowAction(row, k)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="flex list-none flex-col gap-3 p-0 md:hidden">
              {visible.map((row) => (
                <li
                  key={row.id}
                  className="rounded-[var(--radius-md)] border p-4 shadow-[var(--elev-1)]"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/posts/${row.id}`}
                      className="font-semibold leading-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                      style={{ color: 'var(--text)' }}
                    >
                      {row.title || 'Untitled'}
                    </Link>
                    <RowMenu row={row} busy={busyId === row.id} onAction={(k) => onRowAction(row, k)} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    <StatusPill status={row.status} />
                    <span>{row.projectName ?? 'No project'}</span>
                    <span style={{ color: 'var(--text-faint)' }}>{formatRelative(row.updatedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this post?"
        body={toDelete ? `“${toDelete.title || 'Untitled'}” will be permanently removed. This cannot be undone.` : ''}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={onConfirmDelete}
        onCancel={() => (deleting ? undefined : setToDelete(null))}
      />

      <ToastRegion toast={toast} onClose={clear} />
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border px-6 py-16 text-center"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
    >
      <span aria-hidden="true" className="text-3xl" style={{ color: 'var(--text-faint)' }}>
        ✦
      </span>
      <h2 className="m-0 text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
        {title}
      </h2>
      {body && (
        <p className="m-0 max-w-sm text-sm" style={{ color: 'var(--text-muted)' }}>
          {body}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
