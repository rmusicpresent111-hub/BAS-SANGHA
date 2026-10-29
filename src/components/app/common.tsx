'use client'

import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Full-page watermark (logo or blood drop) rendered behind content. */
export function Watermark({ src, opacity = 0.06 }: { src: string; opacity?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
      { }
      <img src={src} alt="" style={{ opacity }} className="w-[130%] max-w-none select-none" />
    </div>
  )
}

/** Repeating tiled watermark for full-page patterns. */
export function TiledWatermark({ src, opacity = 0.05 }: { src: string; opacity?: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        opacity,
        backgroundImage: `url(${src})`,
        backgroundRepeat: 'repeat',
        backgroundSize: '220px 220px',
        transform: 'rotate(-12deg) scale(1.35)',
      }}
    />
  )
}

export function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

/** Sub-page header with back button. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  accent = 'amber',
}: {
  title: string
  subtitle?: string
  onBack: () => void
  accent?: 'amber' | 'red' | 'green' | 'blue'
}) {
  const accents: Record<string, string> = {
    amber: 'from-amber-900 via-amber-800 to-amber-900',
    red: 'from-red-950 via-red-900 to-red-950',
    green: 'from-emerald-950 via-emerald-900 to-emerald-950',
    blue: 'from-blue-950 via-blue-900 to-blue-950',
  }
  return (
    <header className={`sticky top-0 z-40 bg-gradient-to-r ${accents[accent]} px-3 py-3 shadow-lg sm:px-4`}>
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Go back"
          className="shrink-0 rounded-full text-white hover:bg-white/15"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-white sm:text-lg">{title}</h1>
          {subtitle && <p className="truncate text-xs text-white/70">{subtitle}</p>}
        </div>
      </div>
    </header>
  )
}

export function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

export function formatINR(n: number) {
  return '₹' + n.toLocaleString('en-IN')
}
