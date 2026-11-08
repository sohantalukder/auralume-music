type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

const MAX_BUCKETS = 10_000;

// Expired buckets are dropped lazily so the map cannot grow without bound.
function prune(now: number) {
  for (const [key, entry] of buckets) if (entry.resetAt <= now) buckets.delete(key);
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size >= MAX_BUCKETS) prune(now);
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}
