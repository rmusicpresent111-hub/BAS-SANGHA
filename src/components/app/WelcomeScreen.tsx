'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useApp } from '@/lib/store'

const PARTICLES = 18

export default function WelcomeScreen() {
  const { user, setView } = useApp()
  const [phase, setPhase] = useState<'splash' | 'welcome'>('splash')

  // Splash phase -> welcome phase
  useEffect(() => {
    const t = setTimeout(() => setPhase('welcome'), 2300)
    return () => clearTimeout(t)
  }, [])

  // Auto advance after 9 seconds in welcome phase
  useEffect(() => {
    if (phase !== 'welcome') return
    const t = setTimeout(() => setView(user ? 'home' : 'auth'), 9000)
    return () => clearTimeout(t)
  }, [phase, user, setView])

  // Stable random particles
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: 8 + Math.random() * 84,
        size: 3 + Math.random() * 6,
        delay: Math.random() * 4,
        duration: 3.5 + Math.random() * 4,
      })),
    []
  )

  const enter = () => setView(user ? 'home' : 'auth')

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#150404] text-white">
      <AnimatePresence mode="wait">
        {phase === 'splash' ? (
          /* ============ SPLASH (ref 3): glowing logo on near-black ============ */
          <motion.div
            key="splash"
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            className="splash-bg fixed inset-0 flex flex-col items-center justify-center gap-8"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="relative"
            >
              <motion.div
                animate={{ opacity: [0.4, 0.95, 0.4], scale: [1, 1.15, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-10 rounded-full bg-amber-500/30 blur-3xl"
              />
              <div className="ring-glow relative h-32 w-32 overflow-hidden rounded-full bg-white shadow-2xl">
                <Image src="/logo.png" alt="B.A.S Sangha" fill sizes="128px" className="object-contain p-2" priority />
              </div>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, letterSpacing: '0.2em' }}
              animate={{ opacity: 1, letterSpacing: '0.5em' }}
              transition={{ duration: 1.5, delay: 0.4 }}
              className="gold-text pl-[0.5em] text-xl font-black"
            >
              B.A.S SANGHA
            </motion.h1>
          </motion.div>
        ) : (
          /* ============ WELCOME (ref 1): premium animated screen ============ */
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
            className="relative flex min-h-screen flex-col"
            onClick={enter}
            role="button"
            aria-label="Enter the app"
          >
            {/* Kali background */}
            <div className="absolute inset-0">
              <Image
                src="/images/kali-bg.png"
                alt="Maa Kali divine background with diyas and marigold garlands"
                fill
                priority
                className="object-cover object-center opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#2a0808]/88 via-[#1d0505]/72 to-[#120303]/94" />
              <div className="absolute inset-0 bg-[#1a0404]/30" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,2,2,0.68)_100%)]" />
            </div>

            {/* top & bottom gold hairlines */}
            <div className="absolute inset-x-0 top-0 z-20 h-[3px] bg-gradient-to-r from-transparent via-amber-400/90 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 z-20 h-[3px] bg-gradient-to-r from-transparent via-amber-400/90 to-transparent" />

            {/* floating golden particles */}
            {particles.map((p) => (
              <motion.span
                key={p.id}
                className="pointer-events-none absolute z-10 rounded-full bg-amber-300"
                style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, boxShadow: '0 0 10px rgba(252,211,77,0.9)' }}
                animate={{ y: [0, -32, 0], opacity: [0.15, 0.95, 0.15] }}
                transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}

            {/* content */}
            <div className="relative z-10 flex min-h-screen flex-col items-center px-4 pb-8 pt-9 sm:pt-12">
              {/* top: Bengali place + ESTD */}
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.15 }}
                className="flex flex-col items-center"
              >
                <p className="text-lg font-semibold tracking-[0.3em] text-amber-300 sm:text-xl">দক্ষিণ গোবিন্দপুর</p>
                <p className="mt-1.5 text-[11px] font-medium tracking-[0.55em] text-amber-100/70">ESTD · 2021</p>
              </motion.div>

              {/* Welcome To */}
              <motion.h2
                initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1, delay: 0.45 }}
                className="mt-7 text-center text-4xl font-bold text-[#fdf3e3] drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)] sm:text-5xl"
              >
                Welcome To
              </motion.h2>

              {/* B.A.S Sangha gold */}
              <motion.h1
                initial={{ opacity: 0, scale: 0.85, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 1.1, delay: 0.7, ease: 'easeOut' }}
                className="gold-text mt-1 text-center text-5xl font-black leading-tight drop-shadow-[0_4px_24px_rgba(245,158,11,0.4)] sm:text-7xl"
              >
                B.A.S Sangha
              </motion.h1>

              {/* Kali medallion */}
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 80, damping: 13, delay: 1.05 }}
                className="relative mt-7"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative h-56 w-56 sm:h-64 sm:w-64"
                >
                  {/* warm halo behind */}
                  <motion.div
                    animate={{ opacity: [0.45, 0.85, 0.45] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.4),transparent_65%)] blur-xl"
                  />
                  {/* rotating conic gradient ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'conic-gradient(from 0deg, #f59e0b, #ef4444, #f97316, #fbbf24, #dc2626, #f59e0b)',
                      filter: 'drop-shadow(0 0 22px rgba(239,68,68,0.5))',
                    }}
                  />
                  {/* medallion image */}
                  <div className="absolute inset-[7px] overflow-hidden rounded-full border-2 border-amber-200/50 bg-[#1a0606] shadow-inner">
                    <Image
                      src="/images/kali-medallion.png"
                      alt="Maa Kali blessing"
                      fill
                      priority
                      sizes="256px"
                      className="scale-[1.12] object-cover object-top"
                    />
                  </div>
                  {/* orbiting spark */}
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0"
                  >
                    <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(253,230,138,1)]" />
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* Bengali blessing */}
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 1.5 }}
                className="mt-6 max-w-md text-center text-[15px] font-medium leading-relaxed text-amber-200 sm:text-base"
              >
                জয় মা কালী 🙏 — আমাদের সংঘের পরিবারে আপনাকে স্বাগতম
              </motion.p>

              {/* spacer */}
              <div className="flex-1" />

              {/* club logo */}
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 90, damping: 14, delay: 1.8 }}
                className="relative"
              >
                <motion.div
                  animate={{ opacity: [0.35, 0.7, 0.35] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -inset-5 rounded-full bg-amber-400/25 blur-2xl"
                />
                <div className="ring-glow relative h-24 w-24 overflow-hidden rounded-full bg-white shadow-2xl sm:h-28 sm:w-28">
                  <Image src="/logo.png" alt="B.A.S Sangha logo" fill sizes="112px" className="object-contain p-1.5" />
                </div>
              </motion.div>

              {/* Enter button */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 2.2 }}
                className="mt-6"
              >
                <motion.button
                  onClick={enter}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.96 }}
                  className="group relative flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 px-12 py-3.5 text-lg font-bold text-white shadow-[0_10px_36px_rgba(234,88,12,0.5)]"
                >
                  {/* shine sweep */}
                  <motion.span
                    animate={{ x: ['-150%', '150%'] }}
                    transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  />
                  <span className="relative">Enter</span>
                  <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
