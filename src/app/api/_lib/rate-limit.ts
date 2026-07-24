/**
 * Best-effort in-memory fixed-window rate limiter for the login endpoint.
 *
 * CAVEAT (documented, not hidden): this state lives in a single server instance's
 * memory. On Vercel's serverless/multi-instance deploy it is per-instance and
 * resets on cold start — it is a brute-force speed-bump, NOT a durable control.
 * For production hardening, back this with a shared store (Upstash Redis /
 * Vercel KV). It is intentionally simple here so the login route has *some*
 * throttle without adding infra the team hasn't provisioned.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_ATTEMPTS = 10; // per window per key

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (for a Retry-After header). */
  retryAfter: number;
}

/** Record an attempt for `key`; returns whether it is allowed. */
export function rateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > MAX_ATTEMPTS) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** Derive a best-effort client key from proxy headers. */
export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd ? fwd.split(',')[0]!.trim() : req.headers.get('x-real-ip');
  return ip || 'unknown';
}
