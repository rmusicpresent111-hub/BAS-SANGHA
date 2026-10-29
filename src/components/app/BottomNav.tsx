'use client'

import { Home, HandCoins, LayoutGrid, Megaphone, CalendarDays, type LucideIcon } from 'lucide-react'
import { useApp, type View } from '@/lib/store'

function NavItem({
  v,
  label,
  Icon,
  active,
  onClick,
}: {
  v: View
  label: string
  Icon: LucideIcon
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-col items-center gap-0.5 pb-2 pt-1.5 transition-colors ${
        active ? 'text-violet-700' : 'text-stone-400 hover:text-stone-600'
      }`}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
      <span className="text-[10px] font-bold">{label}</span>
      {active && <span className="absolute bottom-0 h-[3px] w-7 rounded-full bg-violet-600" />}
    </button>
  )
}

/** Fixed bottom navigation — Home / Notice / Donate Now / Events / More. */
export default function BottomNav() {
  const { view, setView, setDonationOpen } = useApp()

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(79,70,229,0.08)] backdrop-blur"
    >
      <div className="mx-auto grid max-w-4xl grid-cols-5 px-1">
        <NavItem v="home" label="Home" Icon={Home} active={view === 'home'} onClick={() => setView('home')} />
        <NavItem v="notice" label="Notice" Icon={Megaphone} active={view === 'notice'} onClick={() => setView('notice')} />

        {/* center elevated "Donate Now" button (payment gateway entry) */}
        <div className="relative flex justify-center">
          <button
            onClick={() => setDonationOpen(true)}
            aria-label="Donate Now — UPI payment"
            className="absolute -top-7 flex h-14 w-14 flex-col items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/40 ring-4 ring-white transition-transform hover:scale-105 active:scale-95"
          >
            <HandCoins className="h-6 w-6" />
          </button>
          <span aria-hidden className="flex h-11 flex-col items-center justify-end pb-0.5">
            <span className="text-[9px] font-black uppercase tracking-wide text-amber-600">Donate Now</span>
          </span>
        </div>

        <NavItem v="events" label="Events" Icon={CalendarDays} active={view === 'events'} onClick={() => setView('events')} />
        <NavItem v="more" label="More" Icon={LayoutGrid} active={view === 'more'} onClick={() => setView('more')} />
      </div>
    </nav>
  )
}
