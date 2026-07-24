/**
 * GET /rss.xml — RSS 2.0 feed of PUBLISHED posts only (ACCEPTANCE #3: drafts
 * excluded). Served from `src/app/rss.xml/route.ts` → canonical URL `/rss.xml`.
 * (The Footer component should link here; noted in HANDOFF for frontend.)
 */

import { getRssItems } from '@/server/services';

export const runtime = 'nodejs';
// Revalidate hourly — the feed is derived from published content.
export const revalidate = 3600;

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/$/, '');

const FEED_TITLE = 'Abdullah Zakariyya — Writing';
const FEED_DESCRIPTION =
  'Engineering notes across Web3, Security, and Commerce projects.';

/** Escape the five XML-significant characters so content can't break the feed. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(): Promise<Response> {
  const items = await getRssItems();

  const body = items
    .map((item) => {
      const link = `${SITE_URL}/blog/${item.slug}`;
      const pubDate = item.publishedAt
        ? new Date(item.publishedAt).toUTCString()
        : new Date().toUTCString();
      return [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <description>${escapeXml(item.excerpt)}</description>`,
        `      <pubDate>${pubDate}</pubDate>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(`${SITE_URL}/rss.xml`)}" rel="self" type="application/rss+xml" />
${body}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
