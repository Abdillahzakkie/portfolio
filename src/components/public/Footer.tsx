import { getSiteSettings } from '@/server/services';

/**
 * Public footer landmark. RSS points at the backend-emitted feed (/rss.xml).
 * All links keyboard reachable; external links get rel="noopener".
 */
export async function Footer() {
  const settings = await getSiteSettings();
  const year = new Date().getFullYear();
  const linkStyle: React.CSSProperties = { color: 'var(--text-muted)' };
  return (
    <footer
      style={{ borderTop: '1px solid var(--border)', marginTop: 40 }}
    >
      <div
        style={{
          maxWidth: 'var(--content-max)',
          margin: '0 auto',
          padding: '22px 16px',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
          color: 'var(--text-muted)',
        }}
      >
        <span>© {year} {settings.siteName}</span>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <a href={settings.githubUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            GitHub
          </a>
          <a href={`mailto:${settings.contactEmail}`} style={linkStyle}>
            Email
          </a>
          <a href="/rss.xml" style={linkStyle}>
            RSS
          </a>
          <a
            href="https://nextjs.org"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Built with Next.js
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
