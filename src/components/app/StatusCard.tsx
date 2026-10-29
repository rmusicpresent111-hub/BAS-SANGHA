'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Clock, RefreshCcw, ShieldAlert, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type CommonStatus = 'WAITING' | 'APPROVED' | 'REJECTED'

export default function StatusCard({
  status,
  title,
  approvedLabel,
  waitingLabel,
  id,
  details,
  note,
  onReapply,
}: {
  status: CommonStatus
  title: string
  approvedLabel: string
  waitingLabel?: string
  id?: string
  details: { label: string; value: string }[]
  note?: string | null
  onReapply?: () => void
}) {
  const conf = {
    WAITING: {
      icon: Clock,
      ring: 'bg-amber-100',
      iconColor: 'text-amber-600',
      bar: 'from-amber-500 to-yellow-400',
      chip: 'bg-amber-100 text-amber-800',
      heading: waitingLabel || 'Waiting for Approval',
      text: 'আপনার আবেদন admin দেখছেন। Approve বা Reject হলে এখানেই status দেখতে পাবেন।',
    },
    APPROVED: {
      icon: CheckCircle2,
      ring: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      bar: 'from-emerald-600 to-emerald-400',
      chip: 'bg-emerald-100 text-emerald-800',
      heading: 'Approved! 🎉',
      text: approvedLabel,
    },
    REJECTED: {
      icon: XCircle,
      ring: 'bg-red-100',
      iconColor: 'text-red-600',
      bar: 'from-red-600 to-red-400',
      chip: 'bg-red-100 text-red-800',
      heading: 'Rejected',
      text: 'দুঃখিত! আপনার আবেদনটি admin দ্বারা reject করা হয়েছে।',
    },
  }[status]

  const Icon = conf.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-lg"
    >
      <div className={`h-2 bg-gradient-to-r ${conf.bar}`} />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full ${conf.ring}`}>
            <Icon className={`h-7 w-7 ${conf.iconColor}`} />
          </span>
          <div>
            <span className={`rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-wider ${conf.chip}`}>{status}</span>
            <h3 className="mt-1 text-lg font-black text-stone-900">{conf.heading}</h3>
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm leading-relaxed text-stone-600">{conf.text}</p>

        {note && (
          <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-red-50 p-3 text-xs text-red-700">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Admin note: {note}
          </p>
        )}

        {id && (
          <div className="mt-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">{approvedLabel.split('—')[0]}</p>
            <p className="mt-1 font-mono text-sm font-black text-emerald-900">{id}</p>
          </div>
        )}

        {details.length > 0 && (
          <div className="mt-4 space-y-1.5 rounded-2xl bg-stone-50 p-3.5">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-400">Submitted details</p>
            {details.map((d) => (
              <div key={d.label} className="flex items-start justify-between gap-3 text-sm">
                <span className="shrink-0 text-stone-500">{d.label}</span>
                <span className="text-right font-semibold text-stone-800">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        {status === 'REJECTED' && onReapply && (
          <Button onClick={onReapply} className="mt-4 w-full rounded-xl bg-gradient-to-r from-blue-900 to-blue-700 py-4 font-bold text-white hover:from-blue-800 hover:to-blue-600">
            <RefreshCcw className="mr-1.5 h-4 w-4" /> Fill Form Again
          </Button>
        )}
      </div>
    </motion.div>
  )
}
