'use client'

import { motion } from 'framer-motion'
import type { QuickActionDto } from '@/lib/types'
import { QA_COLORS, QA_ICONS } from '@/lib/qa-options'

/** Six colorful quick-action tiles (পুজো কমিটি / খেলা / সদস্য / নোটিশ / গ্যালারি / যোগাযোগ). */
export default function QuickActions({
  actions,
  onNavigate,
}: {
  actions: QuickActionDto[]
  onNavigate: (link: string) => void
}) {
  if (actions.length === 0) return null

  return (
    <section aria-label="Quick actions" className="mx-3 mt-4 grid grid-cols-6 gap-1.5 sm:gap-3">
      {actions.map((a, i) => {
        const Icon = QA_ICONS[a.icon] || QA_ICONS.landmark
        const c = QA_COLORS[a.color] || QA_COLORS.violet
        return (
          <motion.button
            key={a.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: 'easeOut' }}
            whileTap={{ scale: 0.94 }}
            onClick={() => onNavigate(a.link)}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/70 bg-gradient-to-b ${c.tile} p-2 shadow-sm transition-shadow hover:shadow-md sm:gap-2 sm:p-3`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${c.icon} text-white shadow-md sm:h-12 sm:w-12`}>
              <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
            </span>
            <span className="text-center text-[9px] font-bold leading-tight text-blue-950 sm:text-xs">{a.label}</span>
          </motion.button>
        )
      })}
    </section>
  )
}
