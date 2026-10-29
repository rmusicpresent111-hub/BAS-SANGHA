'use client'

/**
 * Tiny stale-while-revalidate cache for the app's public JSON endpoints.
 *
 * Screens used to fetch on every mount, so every tab switch paid a full
 * network round trip (worst case a serverless cold start) before content
 * appeared. With this cache:
 *  - repeat visits render instantly from cache (no spinner)
 *  - stale entries refresh quietly in the background
 *  - identical URLs share one request and one cache entry
 *  - prefetch() warms the cache during the splash screen
 */

import { useEffect, useState } from 'react'

const TTL_MS = 60_000 // revalidate at most once a minute

type Entry = { data: unknown; at: number }

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()
const listeners = new Map<string, Set<() => void>>()

function emit(url: string) {
  listeners.get(url)?.forEach((fn) => fn())
}

function load(url: string): Promise<unknown> {
  const existing = inflight.get(url)
  if (existing) return existing
  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((json) => {
      cache.set(url, { data: json, at: Date.now() })
      emit(url)
      return json
    })
    .finally(() => {
      inflight.delete(url)
    })
  inflight.set(url, p)
  return p
}

/** Warm the cache ahead of time (e.g. fire during the splash screen). */
export function prefetch(urls: string[]): void {
  for (const url of urls) {
    const e = cache.get(url)
    if (!e || Date.now() - e.at > TTL_MS) load(url).catch(() => {})
  }
}

/**
 * JSON GET with cache. Shows cached data instantly (loading=false) and
 * refreshes in the background when older than TTL. Only shows loading
 * when there is nothing cached at all.
 */
export function useCachedJson<T>(
  url: string,
  opts: { onError?: () => void } = {},
): { data: T | null; loading: boolean } {
  const entry = cache.get(url)
  const [data, setData] = useState<T | null>((entry?.data as T) ?? null)

  useEffect(() => {
    let alive = true
    const update = () => {
      const e = cache.get(url)
      if (alive && e) setData(e.data as T)
    }

    if (!listeners.has(url)) listeners.set(url, new Set())
    listeners.get(url)!.add(update)

    const current = cache.get(url)
    if (!current || Date.now() - current.at > TTL_MS) {
      load(url).catch(() => opts.onError?.())
    }

    return () => {
      alive = false
      listeners.get(url)?.delete(update)
    }
  }, [url])

  return { data, loading: !data }
}
