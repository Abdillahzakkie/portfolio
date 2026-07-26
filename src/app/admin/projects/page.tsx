import Link from 'next/link';
import { getSession } from '@/server/auth';
import { listProjectsForAdmin } from '@/server/services';
import { AdminShell } from '@/components/admin/AdminShell';
import { ProjectTable } from '@/components/admin/ProjectTable';
import type { ProjectRow } from '@/components/admin/types';

export default async function AdminProjectsPage() {
  // Middleware guarantees a session; fall back to a neutral label if absent.
  const session = await getSession();
  const userName = session?.name ?? session?.email ?? 'Admin';

  // Server-render the full list; the table filters/searches client-side.
  const projects = (await listProjectsForAdmin()) as ProjectRow[];

  const header = (
    <div className="flex flex-1 items-center justify-between gap-3">
      <h1
        className="m-0 text-[22px] font-bold"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
      >
        Projects
      </h1>
      <Link
        href="/admin/projects/new"
        data-testid="new-project"
        className="inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-white sm:h-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        style={{ background: 'var(--info)' }}
      >
        <span aria-hidden="true" className="text-base leading-none">
          ＋
        </span>
        New project
      </Link>
    </div>
  );

  return (
    <AdminShell activeNav="projects" user={{ name: userName }} header={header}>
      <ProjectTable initialProjects={projects} />
    </AdminShell>
  );
}
