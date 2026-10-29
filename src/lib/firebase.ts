/**
 * Firebase client SDK (browser only).
 *
 * The web config is public by design — it identifies the Firebase project,
 * it does NOT authorize anything by itself. Real auth/sending happens via
 * Firebase rules + the Admin SDK on the server (see src/lib/firebase-admin.ts).
 *
 * Lazily initialized + SSR-safe: returns null on the server or when env vars
 * are missing, so importing this file can never crash a route.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/** True when the required Firebase web config is present in the env. */
export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
)

/** Get (or lazily create) the Firebase app. Null on server / missing config. */
export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined' || !firebaseConfigured) return null
  try {
    return getApps().length ? getApp() : initializeApp(firebaseConfig)
  } catch (e) {
    console.error('Firebase init failed', e)
    return null
  }
}

/**
 * Get the FCM Messaging instance. Null when the browser (or the current
 * browser context) cannot support Firebase Messaging (no SW, no https, etc).
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  const app = getFirebaseApp()
  if (!app) return null
  try {
    if (!(await isSupported())) return null
    return getMessaging(app)
  } catch {
    return null
  }
}
