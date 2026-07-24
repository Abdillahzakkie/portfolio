import { Skeleton } from '@/components/public/Feedback';

/** Project case-study loading — header block + prose shimmer + card skeletons. */
export default function ProjectLoading() {
  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: '24px 16px 40px' }}>
      <Skeleton variant="card" height={16} width={160} style={{ marginBottom: 20 }} />
      <Skeleton variant="card" height={48} width="55%" style={{ marginBottom: 12 }} />
      <Skeleton variant="card" height={22} width="80%" style={{ marginBottom: 28 }} />
      <div style={{ maxWidth: '68ch' }}>
        <Skeleton variant="text" lines={6} />
      </div>
    </div>
  );
}
