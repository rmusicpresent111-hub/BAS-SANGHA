'use client'

import Image from 'next/image'
import { Phone } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useCachedJson } from '@/lib/client-cache'
import type { HomeData, MemberDto } from '@/lib/types'
import { Loading, ScreenHeader } from './common'
import MainShell from './MainShell'

/** Full member list (opens from Quick Actions / "সবর্ই দেখুন"). */
export default function MembersScreen() {
  const { setView } = useApp()
  const { data } = useCachedJson<HomeData>('/api/public/home')
  const members: MemberDto[] | null = data ? data.members || [] : null

  return (
    <MainShell>
      <ScreenHeader title="সদস্য তালিকা" subtitle="Our committee members" onBack={() => setView('home')} accent="blue" />
      <main className="mx-auto w-full max-w-3xl px-3 py-5">
        {!members && <Loading label="Loading members..." />}

        {members && members.length === 0 && (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-400">
            কোনো সদস্য যোগ করা হয়নি
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {members &&
            members.map((m) => (
              <div key={m.id} className="flex items-center gap-4 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
                <div className="relative h-16 w-16 shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 p-[3px] shadow-md">
                  <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-white bg-white">
                    {m.photoUrl ? (
                      <Image src={m.photoUrl} alt={m.name} fill sizes="64px" className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-amber-50 text-lg font-black text-amber-600">
                        {(m.name || '?').charAt(0)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-stone-400">{m.role}</p>
                  <h3 className="truncate text-base font-black text-blue-950">{m.name}</h3>
                  {m.phone && (
                    <a
                      href={`tel:${m.phone}`}
                      className="mt-0.5 flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Phone className="h-3 w-3" /> {m.phone}
                    </a>
                  )}
                </div>
              </div>
            ))}
        </div>
      </main>
    </MainShell>
  )
}
