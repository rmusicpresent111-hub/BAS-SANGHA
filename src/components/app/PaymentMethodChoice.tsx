'use client'

import { Check, QrCode, Wallet } from 'lucide-react'

export type PayMethod = 'QR' | 'CASH'

/**
 * The two-way payment selector used by EVERY paid flow in the app
 * (Donation / Member Join / Tournament / Drawing):
 * - "QR / UPI" → online payment (scan or UPI app) then submit the UTR number
 * - "Cash" → pay the committee by hand; admin verifies the cash and approves
 */
export default function PaymentMethodChoice({
  value,
  onChange,
  amountText,
  disabled,
}: {
  value: PayMethod
  onChange: (m: PayMethod) => void
  amountText?: string
  disabled?: boolean
}) {
  const opts: { key: PayMethod; title: string; sub: string; icon: typeof QrCode; activeCls: string; ringCls: string }[] = [
    {
      key: 'QR',
      title: 'QR / UPI Payment',
      sub: 'GPay · PhonePe · Paytm — pay করে UTR number জমা দিন',
      icon: QrCode,
      activeCls: 'border-emerald-500 bg-emerald-50/80',
      ringCls: 'bg-emerald-600',
    },
    {
      key: 'CASH',
      title: 'Cash (নগদ টাকা)',
      sub: 'কমিটির হাতে নগদ দিন — admin টাকা পেয়ে verify করে approve দেবে',
      icon: Wallet,
      activeCls: 'border-amber-500 bg-amber-50/80',
      ringCls: 'bg-amber-500',
    },
  ]

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-black uppercase tracking-wide text-stone-500">
        Payment Method {amountText ? <span className="ml-1 normal-case text-stone-400">({amountText})</span> : null}
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
        {opts.map((o) => {
          const Icon = o.icon
          const active = value === o.key
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(o.key)}
              className={`relative rounded-2xl border-2 p-3.5 text-left transition-all disabled:opacity-60 ${
                active ? `${o.activeCls} shadow-md` : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              {/* tick badge */}
              <span
                className={`absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full transition-all ${
                  active ? `${o.ringCls} scale-100 text-white` : 'scale-90 border-2 border-stone-200 bg-white text-transparent'
                }`}
                aria-hidden
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
              </span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-white shadow-sm' : 'bg-stone-100'}`}>
                <Icon className={`h-5 w-5 ${o.key === 'QR' ? 'text-emerald-600' : 'text-amber-600'}`} />
              </span>
              <span className="mt-2 block text-sm font-black text-stone-900">{o.title}</span>
              <span className="mt-0.5 block text-[11px] font-medium leading-relaxed text-stone-500">{o.sub}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
