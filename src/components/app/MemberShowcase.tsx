'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Megaphone, Phone } from 'lucide-react'
import { useApp } from '@/lib/store'
import type { MemberDto } from '@/lib/types'

const STAY_MS = 5000 // auto-advance every 5 seconds

/** Committee header + horizontal snap carousel of member cards (reference design). */
export default function MemberShowcase({ members }: { members: MemberDto[] }) {
  const { setView } = useApp()
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  // keep the scroll position in sync with index
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const card = track.children[index] as HTMLElement | undefined
    if (card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' })
  }, [index])

  // auto-advance
  useEffect(() => {
    if (members.length <= 1) return
    const t = setInterval(() => setIndex((i) => (i + 1) % members.length), STAY_MS)
    return () => clearInterval(t)
  }, [members.length, index])

  if (members.length === 0) return null

  const scrollByCard = (dir: 1 | -1) => {
    setIndex((i) => (i + dir + members.length) % members.length)
  }

  return (
    <section aria-label="Our committee members" className="mt-6">
      <div className="mx-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 shadow-sm">
            <Megaphone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-blue-900 sm:text-lg">আমাদের পুজো কমিটি</h2>
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.18em] text-stone-400 sm:text-[10px]">
              Our Pujo Committee Members
            </p>
          </div>
        </div>
        <button
          onClick={() => setView('members')}
          className="flex shrink-0 items-center gap-1 rounded-full border border-blue-200 bg-white px-3.5 py-1.5 text-[11px] font-bold text-blue-800 shadow-sm transition hover:bg-blue-50 active:scale-95"
        >
          সবর্ই দেখুন <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* carousel */}
      <div className="relative mt-3.5">
        <div
          ref={trackRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-3 pb-1"
        >
          {members.map((m) => (
            <div
              key={m.id}
              className="flex w-[86%] max-w-[400px] shrink-0 snap-center items-center gap-4 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm"
            >
              <div className="relative h-16 w-16 shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 p-[3px] shadow-md">
                <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-white bg-white">
                  <Image src={m.photoUrl} alt={m.name} fill sizes="64px" className="object-cover" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold text-blue-700">{m.role}</p>
                <h3 className="truncate text-base font-black text-blue-950">{m.name}</h3>
                {m.phone && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-stone-500">
                    <Phone className="h-3 w-3 text-emerald-600" /> {m.phone}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {members.length > 1 && (
          <>
            <button
              onClick={() => scrollByCard(-1)}
              aria-label="Previous member"
              className="absolute left-1 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-stone-100 bg-white/95 text-blue-900 shadow-md transition hover:bg-white active:scale-95"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => scrollByCard(1)}
              aria-label="Next member"
              className="absolute right-1 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-stone-100 bg-white/95 text-blue-900 shadow-md transition hover:bg-white active:scale-95"
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
          </>
        )}
      </div>

      {/* position dots */}
      {members.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {members.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setIndex(i)}
              aria-label={`Show member ${m.name}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-amber-500' : 'w-1.5 bg-stone-300 hover:bg-stone-400'}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
