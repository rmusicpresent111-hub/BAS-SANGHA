'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useApp, type View } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import { prefetch } from '@/lib/client-cache'
import { enablePush, onForegroundMessage, pushLocallyEnabled } from '@/lib/push'
import { useToast } from '@/hooks/use-toast'
import WelcomeScreen from '@/components/app/WelcomeScreen'
import AuthScreen from '@/components/app/AuthScreen'
import HomeScreen from '@/components/app/HomeScreen'
import MemberJoinScreen from '@/components/app/MemberJoinScreen'
import TournamentScreen from '@/components/app/TournamentScreen'
import DrawingScreen from '@/components/app/DrawingScreen'
import BloodScreen from '@/components/app/BloodScreen'
import GalleryScreen from '@/components/app/GalleryScreen'
import AdminScreen from '@/components/app/AdminScreen'
import NoticeScreen from '@/components/app/NoticeScreen'
import EventsScreen from '@/components/app/EventsScreen'
import MoreScreen from '@/components/app/MoreScreen'
import MembersScreen from '@/components/app/MembersScreen'

const PROTECTED: View[] = ['home', 'member-join', 'cricket', 'football', 'drawing', 'blood', 'gallery', 'admin', 'notice', 'events', 'more', 'members']

export default function Page() {
  const { view, user, booted, setView, setUser, setBooted } = useApp()
  const { toast } = useToast()

  // push notifications: keep token fresh + show in-app banner while app is open
  useEffect(() => {
    if (!pushLocallyEnabled()) return
    void enablePush().catch(() => {}) // silent refresh (permission already granted)
    let off: (() => void) | undefined
    void onForegroundMessage((title, body) => toast({ title, description: body })).then((un) => {
      off = un
    })
    return () => off?.()
  }, [toast])

  // boot: restore session (Bearer token from localStorage, cookie fallback)
  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setUser(d.user)
      })
      .catch(() => {})
      .finally(() => setBooted(true))
  }, [setUser, setBooted])

  // warm the screen cache during the splash/welcome screen so the first tap
  // on any tab renders instantly instead of waiting for the network
  useEffect(() => {
    prefetch(['/api/public/home', '/api/public/notices', '/api/public/gallery'])
  }, [])

  // route guard: protected views need login
  useEffect(() => {
    if (booted && !user && PROTECTED.includes(view)) setView('auth')
  }, [booted, user, view, setView])

  if (!booted) {
    return (
      <div className="splash-bg flex min-h-dvh flex-col items-center justify-center gap-7">
        <motion.div
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="relative"
        >
          <motion.div
            animate={{ opacity: [0.45, 0.9, 0.45], scale: [1, 1.12, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -inset-9 rounded-full bg-amber-500/25 blur-3xl"
          />
          <div className="ring-glow relative h-28 w-28 overflow-hidden rounded-full bg-white shadow-2xl">
            <img src="/logo.png" alt="B.A.S Sangha" className="h-full w-full object-contain p-1.5" />
          </div>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, letterSpacing: '0.15em' }}
          animate={{ opacity: 1, letterSpacing: '0.45em' }}
          transition={{ duration: 1.4, delay: 0.35 }}
          className="gold-text pl-[0.45em] text-lg font-black sm:text-xl"
        >
          B.A.S SANGHA
        </motion.h1>
      </div>
    )
  }

  let screen: React.ReactNode
  switch (view) {
    case 'welcome':
      screen = <WelcomeScreen />
      break
    case 'auth':
      screen = user ? <HomeScreen /> : <AuthScreen />
      break
    case 'member-join':
      screen = <MemberJoinScreen />
      break
    case 'cricket':
      screen = <TournamentScreen type="CRICKET" />
      break
    case 'football':
      screen = <TournamentScreen type="FOOTBALL" />
      break
    case 'drawing':
      screen = <DrawingScreen />
      break
    case 'blood':
      screen = <BloodScreen />
      break
    case 'gallery':
      screen = <GalleryScreen />
      break
    case 'notice':
      screen = <NoticeScreen />
      break
    case 'events':
      screen = <EventsScreen />
      break
    case 'more':
      screen = <MoreScreen />
      break
    case 'members':
      screen = <MembersScreen />
      break
    case 'admin':
      screen = <AdminScreen />
      break
    default:
      screen = user ? <HomeScreen /> : <WelcomeScreen />
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        {screen}
      </motion.div>
    </AnimatePresence>
  )
}
