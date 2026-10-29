'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/lib/store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type CapListener = { remove: () => Promise<void> }

/**
 * Android hardware back button behaviour — only active inside the Capacitor
 * APK shell. On the normal website this component renders nothing and does
 * nothing, so browser behaviour stays exactly as before.
 *
 * Flow (as requested):
 *   any screen → previous screen → … → home → exit dialog → confirm closes app
 */
export default function AndroidBackHandler() {
  const [exitOpen, setExitOpen] = useState(false)
  const exitOpenRef = useRef(false)
  exitOpenRef.current = exitOpen

  useEffect(() => {
    // only run inside the native Android shell (Capacitor injects
    // window.Capacitor into the WebView; on the web it doesn't exist)
    const cap = (
      window as unknown as {
        Capacitor?: { isNativePlatform?: () => boolean }
      }
    ).Capacitor
    if (!cap?.isNativePlatform?.()) return

    let cancelled = false
    let handle: CapListener | undefined

    void import('@capacitor/app')
      .then(({ App }) => {
        if (cancelled) return
        return App.addListener('backButton', () => {
          // back press while the exit dialog is open just dismisses the dialog
          if (exitOpenRef.current) {
            setExitOpen(false)
            return
          }
          const { view, goBack, setView } = useApp.getState()
          // root screens: confirm before leaving the app
          if (view === 'home' || view === 'welcome' || view === 'auth') {
            setExitOpen(true)
            return
          }
          const prev = goBack()
          if (prev) return
          // no history left (e.g. session restored deep in a screen) → go home
          setView('home')
        }).then((h) => {
          if (cancelled) void h.remove()
          else handle = h
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
      void handle?.remove()
    }
  }, [])

  const confirmExit = async () => {
    try {
      const { App } = await import('@capacitor/app')
      await App.exitApp()
    } catch {
      setExitOpen(false)
    }
  }

  return (
    <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
      <AlertDialogContent className="border-amber-500/25 bg-[#241010] text-amber-50 shadow-2xl shadow-black/60">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-bold text-amber-50">
            অ্যাপ থেকে বের হবেন?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-amber-100/70">
            আপনি কি B.A.S Sangha অ্যাপটি বন্ধ করতে চান?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full border-white/15 bg-white/10 text-amber-50 hover:bg-white/20 hover:text-amber-50">
            না, থাকুন
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmExit}
            className="rounded-full bg-red-600 text-white hover:bg-red-700"
          >
            হ্যাঁ, বের হোন
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
