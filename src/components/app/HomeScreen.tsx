'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp, type View } from '@/lib/store'
import type { HomeData } from '@/lib/types'
import { Loading } from './common'
import AppHeader from './AppHeader'
import HeroBanner from './HeroBanner'
import QuickActions from './QuickActions'
import PujoHighlight from './PujoHighlight'
import MemberShowcase from './MemberShowcase'
import MainShell from './MainShell'
import { useToast } from '@/hooks/use-toast'

export default function HomeScreen() {
  const { setDonationOpen, setView } = useApp()
  const { toast } = useToast()
  const [data, setData] = useState<HomeData | null>(null)
  const committeeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/public/home')
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast({ title: 'Failed to load home', variant: 'destructive' }))
  }, [toast])

  // hide the main window scrollbar while Home is active
  useEffect(() => {
    document.documentElement.classList.add('hide-scrollbar')
    return () => document.documentElement.classList.remove('hide-scrollbar')
  }, [])

  const handleNavigate = (link: string) => {
    if (link === 'committee') {
      committeeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (link === 'donation') {
      setDonationOpen(true)
      return
    }
    setView(link as View)
  }

  if (!data) return <div className="min-h-screen bg-[#eef0fa]"><Loading label="Loading Sangha..." /></div>

  return (
    <MainShell>
      <AppHeader
        settings={data.settings}
        hasNotices={data.notices.length > 0}
        members={data.members}
        events={data.events}
        notices={data.notices}
      />

      <main className="mx-auto w-full max-w-4xl">
        {/* ===== Hero banner (rounded card) ===== */}
        <HeroBanner banners={data.banners} />

        {/* ===== Quick actions grid ===== */}
        <QuickActions actions={data.quickActions} onNavigate={handleNavigate} />

        {/* ===== Pujo highlight banner ===== */}
        <PujoHighlight highlight={data.highlight} />

        {/* ===== Committee members carousel ===== */}
        <div ref={committeeRef} className="scroll-mt-4">
          <MemberShowcase members={data.members} />
        </div>
      </main>
    </MainShell>
  )
}
