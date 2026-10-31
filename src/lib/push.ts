'use client'

/**
 * Push notifications helper — two paths, one device registry.
 *
 *  1. APK (Capacitor Android) → @capacitor/push-notifications → native FCM.
 *     Works even when the app is closed: Android shows the message in the
 *     system tray. Needs google-services.json in android/app/ (built into
 *     the APK) — the WEB push VAPID key is NOT used on this path.
 *  2. Browser (https) → Firebase JS web push (service worker + VAPID key).
 *
 * Both paths end at the same backend registry: POST /api/notifications/register
 * (token saved in the PushToken table, admin tab sends to all of them).
 *
 * Why the split? Android WebView (the APK shell) can NEVER do web push —
 * Notification.permission is always "denied" and getToken() has no push
 * service to talk to. So inside the APK only the native path is attempted.
 */
import { apiFetch } from './api'
import { getFirebaseMessaging } from './firebase'
import { getToken, onMessage, type Messaging } from 'firebase/messaging'

const ENABLED_KEY = 'push_enabled'
const TOKEN_KEY = 'push_token'

const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

/**
 * Firebase SDK's built-in placeholder VAPID key (hardcoded in the SDK source
 * and all tutorials). It does NOT belong to any real Firebase project, so
 * getToken always fails with it — devices never register. Copying it into
 * the env is a classic copy-paste mistake; surface it as a config problem.
 */
const SDK_DEMO_VAPID_PREFIX = 'BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITf'

/** Old APKs (r5 and earlier) have no native push plugin — this tells the user what to do. */
export const PUSH_UPDATE_MESSAGE =
  'Push notification-এর জন্য নতুন APK install করুন — পুরনো অ্যাপ ভার্সনে notification কাজ করে না। GitHub Releases থেকে সর্বশেষ ভার্সন নিন।'

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

function capacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor
  return cap?.isNativePlatform?.() ? cap : null
}

/** Running inside the Android APK shell (or any native Capacitor shell). */
export function isNativeApp(): boolean {
  return capacitor() !== null
}

type PushPlugin = import('@capacitor/push-notifications').PushNotificationsPlugin

let nativePushPlugin: PushPlugin | null | undefined // undefined = not tried yet

/** Lazily import the native push plugin (kept out of the web-only bundle). */
async function getNativePush(): Promise<PushPlugin | null> {
  if (!capacitor()) return null
  if (nativePushPlugin !== undefined) return nativePushPlugin
  try {
    const mod = await import('@capacitor/push-notifications')
    nativePushPlugin = mod.PushNotifications
  } catch {
    nativePushPlugin = null
  }
  return nativePushPlugin
}

/** Browser can do web push at all (secure context + SW + Notification APIs). */
export function pushSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (isNativeApp()) return true // native FCM path — no web APIs needed
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

/** The FCM token this device registered with (if any). */
export function registeredPushToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** Toggle's initial state: notifications are actually active on THIS device. */
export function pushActiveOnDevice(): boolean {
  if (typeof window === 'undefined') return false
  if (isNativeApp()) return pushLocallyEnabled() && !!registeredPushToken()
  return (
    pushSupported() &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted' &&
    pushLocallyEnabled()
  )
}

/** Save token in the backend registry (same endpoint for web + native). */
async function registerTokenWithServer(token: string, platform: 'web' | 'android'): Promise<string | null> {
  try {
    const res = await apiFetch('/api/notifications/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform }),
    })
    if (res.ok) return null
    const d = (await res.json().catch(() => ({}))) as { error?: string }
    return d.error || 'Server token save করতে পারেনি'
  } catch {
    return 'Server-এর সাথে সংযোগ করা যায়নি — ইন্টারনেট দেখে আবার চেষ্টা করুন'
  }
}

function saveLocalFlags(token: string) {
  try {
    localStorage.setItem(ENABLED_KEY, '1')
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* storage unavailable — session still works */
  }
}

/* ---------------- native (APK) path ---------------- */

/** Wait for the native FCM registration event (or fail after 25 s). */
function waitForNativeToken(plugin: PushPlugin): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => finish({ ok: false, error: 'Firebase token পাওয়া যায়নি — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন' }), 25_000)
    const finish = async (result: { ok: true; token: string } | { ok: false; error: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        await regHandle?.remove()
        await errHandle?.remove()
      } catch {
        /* noop */
      }
      resolve(result)
    }
    let regHandle: import('@capacitor/core').PluginListenerHandle | undefined
    let errHandle: import('@capacitor/core').PluginListenerHandle | undefined
    void plugin.addListener('registration', (ev) => {
      void finish({ ok: true, token: ev.value })
    })
    void plugin.addListener('registrationError', (ev) => {
      const detail = String(ev.error || '').slice(0, 140)
      void finish({
        ok: false,
        error: `Firebase token পাওয়া যায়নি${detail ? ` — ${detail}` : ''}`,
      })
    })
    void plugin.register()
  })
}

async function enablePushNative(plugin: PushPlugin): Promise<{ ok: boolean; error?: string }> {
  let perm: string | undefined
  try {
    perm = (await plugin.requestPermissions()).receive
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e ?? '')
    if (msg.toLowerCase().includes('not implemented')) return { ok: false, error: PUSH_UPDATE_MESSAGE }
    return { ok: false, error: 'Notification permission দেওয়া যায়নি' }
  }
  if (perm !== 'granted')
    return { ok: false, error: 'Notification permission denied — device Settings → Apps → B.A.S Sangha থেকে অনুমতি দিন' }

  const reg = await waitForNativeToken(plugin)
  if (!reg.ok) return reg
  const serverErr = await registerTokenWithServer(reg.token, 'android')
  if (serverErr) return { ok: false, error: serverErr }
  saveLocalFlags(reg.token)
  return { ok: true }
}

/* ---------------- browser (web push) path ---------------- */

async function enablePushWeb(): Promise<{ ok: boolean; error?: string }> {
  if (!VAPID)
    return {
      ok: false,
      error: 'Server missing NEXT_PUBLIC_FIREBASE_VAPID_KEY (Firebase console → Web Push certificate)',
    }
  if (VAPID.startsWith(SDK_DEMO_VAPID_PREFIX))
    return {
      ok: false,
      error:
        'Firebase Web Push certificate ভুল আছে — এটা sample key। Firebase Console → Project settings → Cloud Messaging → Web Push certificates থেকে নিজের key generate করে NEXT_PUBLIC_FIREBASE_VAPID_KEY-তে দিন।',
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
    let token: string | null = null
    try {
      token = await getToken(messaging, { vapidKey: VAPID as string, serviceWorkerRegistration: reg })
    } catch (e) {
      // surface the real FCM error (e.g. mismatchSenderId) so the admin can see WHY
      const detail = e instanceof Error ? e.message : String(e ?? '')
      throw new Error(
        `Firebase token পাওয়া যায়নি${detail ? ` — ${detail.slice(0, 140)}` : ''}`
      )
    }
    if (!token) return { ok: false, error: 'Firebase token পাওয়া যায়নি — আবার চেষ্টা করুন' }

    const serverErr = await registerTokenWithServer(token, 'web')
    if (serverErr) return { ok: false, error: serverErr }
    saveLocalFlags(token)
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Notification enable করা যায়নি',
    }
  }
}

/* ---------------- public API ---------------- */

/**
 * Ask permission, get an FCM token (native or web) and register it with the
 * backend. Idempotent — calling again just refreshes the token (recommended
 * on app boot).
 */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'এই ব্রাউজারে notification support নেই' }
  const plugin = await getNativePush()
  if (plugin) return enablePushNative(plugin)
  return enablePushWeb()
}

/** Unregister this device's push token from the backend. */
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
  const plugin = await getNativePush()
  if (plugin) {
    // APK: while the app is open the native plugin fires this event instead
    // of showing the system tray notification — surface it as an in-app toast.
    const handle = await plugin.addListener('pushNotificationReceived', (n) => {
      cb(n.title || 'B.A.S Sangha', n.body || '')
    })
    return () => {
      void handle.remove()
    }
  }
  const messaging = await getFirebaseMessaging()
  if (!messaging) return () => {}
  return onMessage(messaging, (payload) => {
    cb(
      payload.notification?.title || 'B.A.S Sangha',
      payload.notification?.body || payload.data?.body || ''
    )
  })
}
