'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronRight,
  Search,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useApp, type View } from '@/lib/store'
import type { EventDto, MemberDto, NoticeDto } from '@/lib/types'

interface SearchItem {
  key: string
  label: string
  sub: string
  view: View
  Icon: LucideIcon
}

function ActionBtn({
  label,
  onClick,
  children,
  dot,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  dot?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-blue-950/40 text-white backdrop-blur transition hover:bg-blue-900/50 active:scale-95 sm:h-11 sm:w-11 sm:rounded-2xl"
    >
      {children}
      {dot && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-blue-900 sm:right-2 sm:top-2 sm:h-2.5 sm:w-2.5" />
      )}
    </button>
  )
}

/** Royal-blue app header with search / notifications / menu + Member Join pill (reference design). */
export default function AppHeader({
  settings,
  hasNotices,
  members,
  events,
  notices,
}: {
  settings: Record<string, string>
  hasNotices: boolean
  members: MemberDto[]
  events: EventDto[]
  notices: NoticeDto[]
}) {
  const { setView } = useApp()
  const [searchOpen, setSearchOpen] = useState(false)
  const [q, setQ] = useState('')

  const tagline = settings.headerTagline || 'Tradition · Culture · Community'
  const quote = settings.headerQuote || 'একসাথে আমরা, একসাথে শক্তি'
  const joinSubtitle = settings.memberJoinSubtitle || 'আমাদের সাথে যুক্ত হোন'

  const results = useMemo<SearchItem[]>(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    const out: SearchItem[] = []
    for (const m of members) {
      if (`${m.name} ${m.role}`.toLowerCase().includes(needle))
        out.push({ key: `m-${m.id}`, label: m.name, sub: m.role, view: 'members', Icon: Users })
    }
    for (const e of events) {
      if (`${e.title} ${e.type}`.toLowerCase().includes(needle))
        out.push({
          key: `e-${e.id}`,
          label: e.title,
          sub: e.eventDate || 'Club event',
          view: (e.type === 'CRICKET' ? 'cricket' : e.type === 'FOOTBALL' ? 'football' : e.type === 'DRAWING' ? 'drawing' : 'blood') as View,
          Icon: CalendarDays,
        })
    }
    for (const n of notices) {
      if (`${n.title} ${n.body}`.toLowerCase().includes(needle))
        out.push({ key: `n-${n.id}`, label: n.title, sub: 'Notice', view: 'notice', Icon: Bell })
    }
    return out.slice(0, 8)
  }, [q, members, events, notices])

  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-indigo-900 shadow-lg">
      {/* decorative flowing swoosh (reference style: light ribbon sweeping the right side) */}
      <svg
        aria-hidden
        viewBox="0 0 390 210"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <path d="M390 0 C 296 22, 262 84, 292 152 C 310 190, 348 206, 390 210 L 390 0 Z" fill="#3b82f6" opacity="0.32" />
        <path d="M390 0 C 326 30, 300 90, 324 150 C 340 188, 364 202, 390 206 L 390 0 Z" fill="#60a5fa" opacity="0.28" />
        <path d="M0 150 C 110 116, 224 126, 390 36 L 390 0 C 232 58, 112 68, 0 94 Z" fill="#2563eb" opacity="0.22" />
        <path d="M298 0 C 266 54, 274 122, 330 180" stroke="#93c5fd" strokeWidth="2" fill="none" opacity="0.45" />
        <circle cx="352" cy="34" r="46" fill="#93c5fd" opacity="0.12" />
      </svg>

      <div className="relative mx-auto max-w-4xl px-4 pb-6 pt-4">
        {/* top row: identity + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white shadow-lg ring-2 ring-amber-300 sm:h-14 sm:w-14">
              <Image src="/logo.png" alt="B.A.S Sangha logo" width={56} height={56} className="h-full w-full object-contain p-1" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-wide text-white sm:text-2xl">B.A.S SANGHA</h1>
              <p className="truncate text-[10px] font-medium text-blue-100/85 sm:text-[11px]">Dakshin Gobindapur • Estd 2021</p>
              <p className="truncate font-serif text-[10px] italic tracking-wide text-blue-200/85 sm:text-[11px]">{tagline}</p>
            </div>
          </div>

          <div className="flex shrink-0 gap-1 sm:gap-2">
            <ActionBtn label="Search" onClick={() => setSearchOpen(true)}>
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </ActionBtn>
            <ActionBtn label="Notices" onClick={() => setView('notice')} dot={hasNotices}>
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            </ActionBtn>
          </div>
        </div>

        {/* second row: member join pill + quote beside it (reference design) */}
        <div className="mt-4 flex items-center gap-2.5 sm:gap-3">
          <motion.button
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            onClick={() => setView('member-join')}
            className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-white/20 bg-blue-950/25 p-2 pr-2.5 text-left shadow-inner backdrop-blur transition hover:bg-blue-950/35 active:scale-[0.99] sm:gap-3 sm:p-2.5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-800 shadow sm:h-11 sm:w-11">
              <Users className="h-5 w-5 fill-current" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-white sm:text-base">Member Join</span>
              <span className="block truncate text-[10px] font-medium text-blue-100/75 sm:text-[11px]">{joinSubtitle}</span>
            </span>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-blue-900 shadow transition-transform group-hover:translate-x-0.5 sm:h-8 sm:w-8">
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </motion.button>

          <p className="w-[68px] shrink-0 text-right font-serif text-[9px] italic font-semibold leading-snug text-white/90 sm:w-44 sm:text-xs">
            <span className="text-amber-300">“</span>
            {quote}
            <span className="text-amber-300">”</span>
          </p>
        </div>
      </div>

      {/* decorative petal & leaves (bottom-right, like reference) */}
      <svg
        aria-hidden
        viewBox="0 0 240 120"
        className="pointer-events-none absolute bottom-4 right-0 h-20 w-40 sm:h-24 sm:w-48"
      >
        <path d="M240 120 C 168 104, 138 52, 178 0 L 240 0 Z" fill="#fff1f2" opacity="0.5" />
        <path d="M240 116 C 186 96, 168 52, 196 10" stroke="#fecdd3" strokeWidth="2.5" fill="none" opacity="0.7" />
        <path d="M150 112 C 128 94, 128 66, 150 54 C 160 74, 160 96, 150 112 Z" fill="#bbf7d0" opacity="0.85" />
        <path d="M170 108 C 164 88, 174 68, 192 62 C 192 84, 184 100, 170 108 Z" fill="#86efac" opacity="0.75" />
        <circle cx="136" cy="100" r="4.5" fill="#fbbf24" />
        <circle cx="122" cy="88" r="2.5" fill="#fcd34d" />
        <circle cx="116" cy="102" r="2" fill="#fde68a" />
      </svg>

      {/* wave into page background (deeper curve like reference) */}
      <svg aria-hidden viewBox="0 0 400 28" preserveAspectRatio="none" className="absolute -bottom-px left-0 h-6 w-full text-[#eef0fa]">
        <path d="M0 28 L0 16 Q 90 0 190 13 T 400 8 L400 28 Z" fill="currentColor" />
      </svg>

      {/* search dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-sm rounded-3xl bg-white p-0 sm:max-w-md">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-base font-black text-stone-900">Search</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="সদস্য, ইভেন্ট বা নোটিশ খুঁজুন..."
              className="h-11 rounded-xl border-stone-200 bg-stone-50"
              aria-label="Search members, events and notices"
            />
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
              {q.trim() && results.length === 0 && (
                <p className="rounded-xl bg-stone-50 p-4 text-center text-xs text-stone-400">কিছু পাওয়া যায়নি</p>
              )}
              {results.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setSearchOpen(false)
                    setQ('')
                    setView(r.view)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-stone-100 bg-white p-2.5 text-left transition hover:bg-blue-50/60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <r.Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-stone-800">{r.label}</span>
                    <span className="block truncate text-[11px] text-stone-400">{r.sub}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
                </button>
              ))}
              {!q.trim() && (
                <p className="rounded-xl bg-stone-50 p-4 text-center text-xs text-stone-400">
                  নাম লিখে সদস্য, ইভেন্ট বা নোটিশ খুঁজুন
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
