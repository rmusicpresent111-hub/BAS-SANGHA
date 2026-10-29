/**
 * Tiny in-memory sliding-window rate limiter (per process).
 * Protects auth endpoints (login / forgot) from brute-force attempts.
 * No external middleware needed — local memory caching per the app stack.
 */

type Hit = { count: number; resetAt: number }

const buckets = new Map<string, Hit>()

/** Max `max` requests per `windowMs` for a given key. Returns true if allowed. */
export function rateLimit(key: string, max = 5, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now()
  const hit = buckets.get(key)

  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  hit.count += 1
  return hit.count <= max
}

/** Best-effort client IP for rate-limit keys (behind the gateway proxy). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'local'
}

/** Occasionally drop expired buckets so the map stays small. */
export function pruneRateLimits(): void {
  const now = Date.now()
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k)
}
