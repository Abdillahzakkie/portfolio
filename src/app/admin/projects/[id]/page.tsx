import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth';
import { getProjectForEditor } from '@/server/services';
import type { ProjectDraft as ServiceProjectDraft } from '@/server/services';
import { ProjectEditor } from '@/components/admin/ProjectEditor';
import { emptyProjectDraft, type ProjectDraft } from '@/components/admin/types';

/**
 * Normalize the service `ProjectDraft` (graph numbers `number | undefined`,
 * optional link fields) into the editor's UI `ProjectDraft` (graph numbers
 * `number | ''`, fully-populated links). Defensive: fills every UI-only default
 * so a partially-shaped record can never render `undefined` into an input.
 */
function normalizeDraft(p: ServiceProjectDraft): ProjectDraft {
  const base = emptyProjectDraft();
  return {
    ...base,
    id: p.id,
    title: p.title ?? '',
    slug: p.slug ?? '',
    domain: p.domain ?? '',
    summary: p.summary ?? '',
    role: p.role ?? '',
    stack: p.stack ?? [],
    heroText: p.heroText ?? '',
    longDescription: p.longDescription ?? '',
    links: {
      repo: p.links?.repo ?? '',
      live: p.links?.live ?? '',
      docs: p.links?.docs ?? '',
      extra: (p.links?.extra ?? []).map((e) => ({ label: e.label ?? '', url: e.url ?? '' })),
    },
    graph: {
      cluster: p.graph?.cluster ?? '',
      x: p.graph?.x ?? '',
      y: p.graph?.y ?? '',
      weight: p.graph?.weight ?? '',
    },
    order: p.order ?? 0,
    featured: Boolean(p.featured),
    relatedPostSlugs: p.relatedPostSlugs ?? [],
  };
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  const userName = session?.name ?? session?.email ?? 'Admin';

  const project = await getProjectForEditor(id);
  if (!project) notFound();

  return <ProjectEditor user={{ name: userName }} initial={normalizeDraft(project)} />;
}
