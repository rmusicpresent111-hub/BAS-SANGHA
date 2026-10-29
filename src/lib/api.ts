'use client'

/**
 * Auth token storage + fetch wrapper.
 *
 * The app often runs inside a cross-site iframe (preview panel) where browsers
 * block SameSite=Lax cookies, so cookie-only sessions silently fail (every
 * protected API returns 401 right after login). To stay reliable everywhere we
 * also keep the JWT in localStorage and send it as an Authorization: Bearer
 * header. The server accepts either (see getUser in lib/auth.ts).
 */

const TOKEN_KEY = 'bas_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* storage unavailable — cookie session still works */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* noop */
  }
}

/** fetch() that automatically attaches the Bearer token when present. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {})
  const token = getToken()
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers, credentials: 'same-origin' })
}
