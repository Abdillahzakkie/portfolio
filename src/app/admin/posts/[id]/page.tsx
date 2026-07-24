import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth';
import { getPostForEditor, listProjectOptions } from '@/server/services';
import { PostEditor } from '@/components/admin/PostEditor';
import type { PostDraft, ProjectOption } from '@/components/admin/types';

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  const userName = session?.name ?? session?.email ?? 'Admin';

  const [post, projects] = await Promise.all([
    getPostForEditor(id),
    listProjectOptions() as Promise<ProjectOption[]>,
  ]);

  if (!post) notFound();

  // Normalize into the editor's PostDraft shape (defensive: fill UI-only fields).
  const initial: PostDraft = {
    ...(post as PostDraft),
    domain: (post as PostDraft).domain ?? '',
    tags: (post as PostDraft).tags ?? [],
    seo: (post as PostDraft).seo ?? {},
  };

  return <PostEditor user={{ name: userName }} projects={projects} initial={initial} />;
}
