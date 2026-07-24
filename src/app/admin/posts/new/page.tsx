import { getSession } from '@/server/auth';
import { listProjectOptions } from '@/server/services';
import { PostEditor } from '@/components/admin/PostEditor';
import type { ProjectOption } from '@/components/admin/types';

export default async function NewPostPage() {
  const session = await getSession();
  const userName = session?.name ?? session?.email ?? 'Admin';
  const projects = (await listProjectOptions()) as ProjectOption[];

  return <PostEditor user={{ name: userName }} projects={projects} />;
}
