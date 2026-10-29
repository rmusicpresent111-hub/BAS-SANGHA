'use client'

import { CalendarDays, Megaphone } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useCachedJson } from '@/lib/client-cache'
import type { NoticeDto } from '@/lib/types'
import { Loading, ScreenHeader } from './common'
import MainShell from './MainShell'

export default function NoticeScreen() {
  const { setView } = useApp()
  const { data } = useCachedJson<{ notices?: NoticeDto[] }>('/api/public/notices')
  const notices: NoticeDto[] | null = data ? data.notices || [] : null

  return (
    <MainShell>
      <ScreenHeader title="নোটিশ বোর্ড" subtitle="Club notices & announcements" onBack={() => setView('home')} accent="blue" />
      <main className="mx-auto w-full max-w-3xl space-y-3 px-3 py-5">
        {!notices && <Loading label="Loading notices..." />}

        {notices && notices.length === 0 && (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-stone-300" />
            <p className="mt-3 text-sm font-bold text-stone-500">এখনো কোনো নোটিশ নেই</p>
            <p className="mt-1 text-xs text-stone-400">নতুন নোটিশ এলে এখানে দেখতে পাবেন</p>
          </div>
        )}

        {notices &&
          notices.map((n, i) => (
            <article
              key={n.id}
              className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
                  <Megaphone className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-black leading-snug text-blue-950 sm:text-base">{n.title}</h2>
                  <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-stone-600">{n.body}</p>
                  <p className="mt-2.5 flex items-center gap-1 text-[10px] font-semibold text-stone-400">
                    <CalendarDays className="h-3 w-3" />
                    {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </article>
          ))}
      </main>
    </MainShell>
  )
}
