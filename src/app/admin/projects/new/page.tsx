import { getSession } from '@/server/auth';
import { ProjectEditor } from '@/components/admin/ProjectEditor';

export default async function NewProjectPage() {
  const session = await getSession();
  const userName = session?.name ?? session?.email ?? 'Admin';

  return <ProjectEditor user={{ name: userName }} />;
}
