import { Skeleton } from '@/components/public/Feedback';

/** Blog index loading — heading + 6 PostCard skeletons (docs/03 §3). */
export default function BlogLoading() {
  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: '24px 16px 40px' }}>
      <Skeleton variant="card" height={38} width="40%" style={{ marginBottom: 12 }} />
      <Skeleton variant="card" height={20} width="70%" style={{ marginBottom: 28 }} />
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <Skeleton variant="card" height={190} />
          </li>
        ))}
      </ul>
    </div>
  );
}
