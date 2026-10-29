'use client'

import type { ReactNode } from 'react'
import BottomNav from './BottomNav'
import DonationDialog from './DonationDialog'

/** Shell for the main tabbed screens (home / notice / events / more): light lavender bg + fixed bottom nav + donation dialog. */
export default function MainShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#eef0fa] pb-28">
      {children}
      <BottomNav />
      <DonationDialog />
    </div>
  )
}
