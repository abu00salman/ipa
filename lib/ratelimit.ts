interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window limiter, in memory. Good for a single instance (login brute force, API abuse).
 * For multiple instances, move this to a shared store such as Redis or Cloudflare rate limiting.
 */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const nowMs = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= nowMs) {
    buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
