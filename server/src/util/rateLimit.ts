/**
 * Tiny fixed-window in-memory rate limiter. Keys are strings (userId, IP);
 * no persistence needed — restart clears buckets, which is fine for MVP.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Drop expired buckets occasionally so the map cannot grow unbounded. */
function sweep(now: number): void {
  if (buckets.size < 10_000) return;
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

/** True when this key may act again; counts the hit when allowed. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}
