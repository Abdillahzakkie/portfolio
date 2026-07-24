/** Small pure formatting helpers (safe for server + client). */

/** Human date, e.g. "May 12, 2026". Falls back gracefully on bad/empty input. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Machine-readable date for a <time dateTime> attribute (YYYY-MM-DD). */
export function isoDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** "8 min read" — reading time is precomputed by the backend on save. */
export function readTimeLabel(minutes: number | null | undefined): string {
  const m = Math.max(1, Math.round(minutes ?? 0));
  return `${m} min read`;
}
