/**
 * Minimal in-memory sliding-window rate limiter.
 * Good enough for a single instance; swap for Upstash/Redis when running on multiple
 * serverless instances (see docs/DECISIONS.md).
 */
const hits = new Map<string, number[]>();

function recent(key: string, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.set(key, list);
  return list;
}

/** Counts this call and says whether it is still allowed (every call counts). */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const list = recent(key, windowMs);
  if (list.length >= limit) return false;
  list.push(Date.now());
  return true;
}

/** True when `limit` hits were already recorded in the window. Does not count the call itself. */
export function isLimited(key: string, limit: number, windowMs: number): boolean {
  return recent(key, windowMs).length >= limit;
}

/** Records one hit (e.g. a failed login attempt). */
export function recordHit(key: string) {
  hits.set(key, [...(hits.get(key) ?? []), Date.now()]);
}

/** Forgets all hits for a key (e.g. after a successful login). */
export function resetHits(key: string) {
  hits.delete(key);
}
