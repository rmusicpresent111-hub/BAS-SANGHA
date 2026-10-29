import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor configuration for the B.A.S Sangha Android app.
 *
 * The APK is a native Android shell around the live Next.js site
 * (https://bas-sangha.vercel.app). All pages, API routes, NextAuth and the
 * Turso database keep running on Vercel — so every website update shows up
 * in the installed app instantly, without rebuilding the APK.
 *
 * The Android hardware back button is handled by
 * src/components/app/AndroidBackHandler.tsx (deployed with the website):
 *   page → previous page → … → home → exit dialog → confirm closes the app.
 */
const config: CapacitorConfig = {
  appId: 'com.bassangha.app',
  appName: 'B.A.S Sangha',
  webDir: 'www',
  server: {
    // load the production site inside the WebView (bridge still injected,
    // so native plugins like the back-button listener keep working)
    url: 'https://bas-sangha.vercel.app',
    cleartext: false,
  },
}

export default config
