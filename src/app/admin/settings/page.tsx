import { getSession } from '@/server/auth';
import { getSiteSettings } from '@/server/services';
import { AdminShell } from '@/components/admin/AdminShell';
import { SettingsForm, type SettingsInitial } from '@/components/admin/SettingsForm';

export default async function AdminSettingsPage() {
  // Middleware guarantees a session; fall back to a neutral label if absent.
  const session = await getSession();
  const userName = session?.name ?? session?.email ?? 'Admin';

  // `getSiteSettings` is defensive server-side (falls back to defaults on error),
  // so the cards always render populated values — never a blank screen.
  const settings = await getSiteSettings();

  const initial: SettingsInitial = {
    displayName: session?.name ?? '',
    siteName: settings.siteName ?? '',
    siteDescription: settings.siteDescription ?? '',
    githubUrl: settings.githubUrl ?? '',
    contactEmail: settings.contactEmail ?? '',
    defaultOgImage: settings.defaultOgImage ?? '',
  };

  const header = (
    <h1
      className="m-0 text-[22px] font-bold"
      style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
    >
      Settings
    </h1>
  );

  return (
    <AdminShell activeNav="settings" user={{ name: userName }} header={header}>
      <SettingsForm initial={initial} />
    </AdminShell>
  );
}
