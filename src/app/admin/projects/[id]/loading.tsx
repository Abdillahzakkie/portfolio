/** Shape-matched skeleton shown while the editor's project data loads. */
export default function EditProjectLoading() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading editor…</span>
      <div
        className="flex items-center gap-3 border-b px-6 py-3.5"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
      >
        <div className="h-6 w-24 rounded-md motion-safe:animate-pulse" style={{ background: 'var(--surface-2)' }} />
        <div className="ml-auto h-9 w-40 rounded-md motion-safe:animate-pulse" style={{ background: 'var(--surface-2)' }} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4 p-7">
          <div className="h-10 w-2/3 rounded-md motion-safe:animate-pulse" style={{ background: 'var(--surface-2)' }} />
          <div className="h-11 w-full rounded-md motion-safe:animate-pulse" style={{ background: 'var(--surface-2)' }} />
          <div className="h-[440px] w-full rounded-md motion-safe:animate-pulse" style={{ background: 'var(--surface-2)' }} />
        </div>
        <div className="space-y-4 p-6" style={{ background: 'var(--bg-elevated)' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded-md motion-safe:animate-pulse" style={{ background: 'var(--surface-2)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
