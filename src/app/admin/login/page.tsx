import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';
import { LoginForm } from '@/components/admin/LoginForm';

/** Only allow same-app relative paths as a post-login redirect (no open redirect). */
function safeNext(next?: string): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/admin';
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);

  // Already signed in → skip the form.
  const session = await getSession();
  if (session) redirect(target);

  return (
    <main
      className="grid min-h-screen place-items-center p-4"
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="w-full max-w-[380px]">
        <div
          className="mb-5 flex items-center justify-center gap-2.5 text-[22px] font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
        >
          <span aria-hidden="true" style={{ color: 'var(--info)' }}>
            ◆
          </span>
          AZ
          <span className="font-medium" style={{ color: 'var(--text-faint)' }}>
            · Admin
          </span>
        </div>
        <LoginForm next={target} />
      </div>
    </main>
  );
}
