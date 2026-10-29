'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { CalendarDays, MapPin } from 'lucide-react'
import { useApp } from '@/lib/store'
import type { EventDto, HomeData, EventType } from '@/lib/types'
import { formatINR, Loading, ScreenHeader } from './common'
import MainShell from './MainShell'

const EVENT_VIEWS: Record<EventType, 'cricket' | 'football' | 'drawing' | 'blood'> = {
  CRICKET: 'cricket',
  FOOTBALL: 'football',
  DRAWING: 'drawing',
  BLOOD: 'blood',
}

export default function EventsScreen() {
  const { setView } = useApp()
  const [data, setData] = useState<HomeData | null>(null)

  useEffect(() => {
    fetch('/api/public/home')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const events: EventDto[] = data?.events || []

  return (
    <MainShell>
      <ScreenHeader title="ইভেন্টসমূহ" subtitle="Club events & tournaments" onBack={() => setView('home')} accent="blue" />
      <main className="mx-auto w-full max-w-3xl px-3 py-5">
        {!data && <Loading label="Loading events..." />}

        {data && events.length === 0 && (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-400">
            এখনো কোনো ইভেন্ট নেই
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {events.map((ev, i) => (
            <motion.button
              key={ev.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.45 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setView(EVENT_VIEWS[ev.type as EventType] || 'events')}
              className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white text-left shadow-md transition-shadow hover:shadow-xl"
            >
              <div className="relative h-32 w-full overflow-hidden sm:h-36">
                <Image
                  src={ev.bannerUrl}
                  alt={ev.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 400px"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="p-3.5">
                <h3 className="text-base font-bold text-stone-900">{ev.title}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-stone-500">
                  <CalendarDays className="h-3.5 w-3.5 text-amber-600" /> {ev.eventDate || 'Date to be announced'}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="flex items-center gap-1 text-[11px] text-stone-500">
                    <MapPin className="h-3 w-3 text-red-500" /> <span className="max-w-[150px] truncate">{ev.venue || 'B.A.S Sangha'}</span>
                  </p>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-900">
                    {ev.fee > 0 ? `Entry ${formatINR(ev.fee)}` : 'Free Entry'}
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </main>
    </MainShell>
  )
}
