import { Skeleton } from '@/components/public/Feedback';

/** Blog post loading — title + meta skeleton + prose shimmer (docs/03 §4). */
export default function PostLoading() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 40px' }}>
      <Skeleton variant="card" height={16} width={120} style={{ marginBottom: 16 }} />
      <Skeleton variant="card" height={44} width="85%" style={{ marginBottom: 12 }} />
      <Skeleton variant="card" height={18} width="45%" style={{ marginBottom: 28 }} />
      <Skeleton variant="card" height={90} style={{ marginBottom: 32 }} />
      <Skeleton variant="text" lines={8} />
    </div>
  );
}
