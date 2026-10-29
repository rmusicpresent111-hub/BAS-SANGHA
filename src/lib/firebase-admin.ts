/**
 * Firebase Admin SDK (server only — NEVER import this from client code).
 *
 * Credentials come from the FIREBASE_SERVICE_ACCOUNT_KEY env var: paste the
 * FULL JSON of the service-account private key (Firebase console → Project
 * settings → Service accounts → Generate new private key).
 *
 * Without it the app still boots — every admin push send returns a clear
 * 501 telling the admin what to configure. Get it via getAdminMessaging().
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getMessaging, type Messaging } from 'firebase-admin/messaging'

interface ServiceAccount {
  projectId: string
  clientEmail: string
  privateKey: string
}

let cachedApp: App | null | undefined // undefined = not tried yet, null = unavailable

function serviceAccountFromEnv(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!raw || raw.trim().length < 40) return null
  try {
    // Accepts either the raw JSON or a base64-encoded JSON string.
    const json = JSON.parse(
      raw.trim().startsWith('{') ? raw : Buffer.from(raw.trim(), 'base64').toString('utf8')
    ) as Record<string, unknown>
    const projectId = typeof json.project_id === 'string' ? json.project_id : ''
    const clientEmail = typeof json.client_email === 'string' ? json.client_email : ''
    const privateKey =
      typeof json.private_key === 'string' ? json.private_key.replace(/\\n/g, '\n') : ''
    if (!projectId || !clientEmail || !privateKey) return null
    return { projectId, clientEmail, privateKey }
  } catch {
    return null
  }
}

/** Whether server-side FCM sending is configured (service account present). */
export function adminMessagingConfigured(): boolean {
  return serviceAccountFromEnv() !== null
}

/** Admin Messaging instance, or null when the service account is missing/invalid. */
export function getAdminMessaging(): Messaging | null {
  const sa = serviceAccountFromEnv()
  if (!sa) return null
  if (cachedApp === undefined) {
    try {
      cachedApp =
        getApps().find((a) => a.name === 'bas-admin') ??
        initializeApp({ credential: cert(sa) }, 'bas-admin')
    } catch (e) {
      console.error('Firebase Admin init failed — check FIREBASE_SERVICE_ACCOUNT_KEY', e)
      cachedApp = null
    }
  }
  if (!cachedApp) return null
  try {
    return getMessaging(cachedApp)
  } catch {
    return null
  }
}
