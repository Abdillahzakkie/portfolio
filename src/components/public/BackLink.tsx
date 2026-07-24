import Link from 'next/link';

interface BackLinkProps {
  href: string;
  label: string;
}

/** "← Back to …" navigation link (e.g. back to the constellation / all writing). */
export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--text-muted)',
        padding: '10px 0',
        minHeight: 44,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </Link>
  );
}

export default BackLink;
