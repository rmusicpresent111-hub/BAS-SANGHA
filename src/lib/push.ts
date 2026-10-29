'use client'

/**
 * Push notifications helper (Firebase Cloud Messaging, web).
 *
 * Flow:
 *  enable  → permission → register /firebase-messaging-sw.js → getToken
 *          → POST /api/notifications/register (token saved in PushToken table)
 *  disable → DELETE /api/notifications/register → local flags cleared
 *
 * Requires NEXT_PUBLIC_FIREBASE_VAPID_KEY (Firebase console → Cloud Messaging
 * → Web Push certificates) for getToken to work in browsers.
 */
import { getFirebaseMessaging } from './firebase'
import { apiFetch } from './api'
import { getToken, onMessage, type Messaging } from 'firebase/messaging'

const ENABLED_KEY = 'push_enabled'
const TOKEN_KEY = 'push_token'

const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

/** Browser can do web push at all (secure context + SW + Notification APIs). */
export function pushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'Notification' in window && window.isSecureContext
}

/** User enabled notifications in this app before (local flag). */
export function pushLocallyEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

/** The FCM token this browser registered with (if any). */
export function registeredPushToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/**
 * Ask permission, get an FCM token and register it with the backend.
 * Idempotent — calling again just refreshes the token (recommended on app boot).
 */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'এই ব্রাউজারে notification support নেই' }
  if (!VAPID)
    return {
      ok: false,
      error: 'Server missing NEXT_PUBLIC_FIREBASE_VAPID_KEY (Firebase console → Web Push certificate)',
    }
  const messaging = await getFirebaseMessaging()
  if (!messaging) return { ok: false, error: 'এই ব্রাউজারে Firebase Messaging support নেই' }

  let perm = Notification.permission
  if (perm === 'default') {
    try {
      perm = await Notification.requestPermission()
    } catch {
      return { ok: false, error: 'Notification permission দেওয়া যায়নি' }
    }
  }
  if (perm !== 'granted') return { ok: false, error: 'Notification permission denied' }

  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    await navigator.serviceWorker.ready // SW must be active before getToken
    const token = await getTokenWithVapid(messaging, reg)
    if (!token) return { ok: false, error: 'Firebase token পাওয়া যায়নি — আবার চেষ্টা করুন' }

    const res = await apiFetch('/api/notifications/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string }
      return { ok: false, error: d.error || 'Server token save করতে পারেনি' }
    }
    try {
      localStorage.setItem(ENABLED_KEY, '1')
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable — session still works */
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Notification enable করা যায়নি',
    }
  }
}

/** Unregister this browser's push token from the backend. */
export async function disablePush(): Promise<void> {
  const token = registeredPushToken()
  try {
    localStorage.removeItem(ENABLED_KEY)
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* noop */
  }
  if (token) {
    try {
      await apiFetch('/api/notifications/register', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
    } catch {
      /* best effort */
    }
  }
}

/** Foreground (app open) message listener. Returns an unsubscribe function. */
export async function onForegroundMessage(
  cb: (title: string, body: string) => void
): Promise<() => void> {
  const messaging = await getFirebaseMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, (payload) => {
    cb(
      payload.notification?.title || 'B.A.S Sangha',
      payload.notification?.body || payload.data?.body || ''
    )
  })
}
async function getTokenWithVapid(messaging: Messaging, reg: ServiceWorkerRegistration) {
  try {
    return await getToken(messaging, { vapidKey: VAPID as string, serviceWorkerRegistration: reg })
  } catch (e) {
    console.error('getToken failed', e)
    return null
  }
}
