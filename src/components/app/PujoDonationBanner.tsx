'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ChevronRight, Copy, HandCoins, QrCode, Undo2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { formatINR } from './common'

const PRESETS = [51, 101, 251, 501, 1100]

/** Clickable Pujo-donation poster shown right below the hero banner. */
export default function PujoDonationBanner() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'amount' | 'pay'>('amount')
  const [amount, setAmount] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [upiId, setUpiId] = useState('')
  const [loadingQr, setLoadingQr] = useState(false)

  const chosen = amount ?? (Number(custom) > 0 ? Math.round(Number(custom)) : null)

  const loadQr = async (amt: number) => {
    setLoadingQr(true)
    try {
      const r = await fetch(`/api/public/payment-qr?amount=${amt}&note=${encodeURIComponent('Pujo Donation')}`)
      const d = await r.json()
      setQr(d.dataUrl)
      setUpiId(d.upiId)
      setStep('pay')
    } catch {
      toast({ title: 'Failed to load payment QR', variant: 'destructive' })
    } finally {
      setLoadingQr(false)
    }
  }

  // preload QR in the background so the pay step opens instantly
  useEffect(() => {
    if (!open || qr) return
    fetch(`/api/public/payment-qr?amount=101&note=${encodeURIComponent('Pujo Donation')}`)
      .then((r) => r.json())
      .then((d) => {
        setQr(d.dataUrl)
        setUpiId(d.upiId)
      })
      .catch(() => {})
  }, [open, qr])

  return (
    <>
      <section aria-label="Pujo donation" className="relative w-full">
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          whileTap={{ scale: 0.985 }}
          onClick={() => setOpen(true)}
          aria-label="মায়ের পুজোয় আর্থিক সাহায্যের জন্য এখানে ক্লিক করুন"
          className="group relative block w-full cursor-pointer overflow-hidden border-b-2 border-amber-400/70 shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {/* full-width invitation card — edge to edge on both sides */}
          <div className="relative w-full">
            <Image
              src="/images/pujo-donation-card.jpg"
              alt="Sarbajanin Shri Shri Shyama Puja invitation card"
              width={1600}
              height={987}
              sizes="100vw"
              className="h-auto w-full object-cover"
            />
          </div>

          {/* shine sweep */}
          <motion.div
            aria-hidden
            animate={{ x: ['-120%', '220%'] }}
            transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 4.5, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />

          {/* CTA text overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent pb-3 pt-12 sm:pb-4">
            <div className="flex items-center justify-center gap-2.5 px-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-300 shadow-md ring-2 ring-white/40">
                <HandCoins className="h-5 w-5 animate-pulse text-amber-950" />
              </span>
              <p className="text-center text-[13px] font-black leading-snug text-white drop-shadow sm:text-lg">
                মায়ের পুজোয় আর্থিক সাহায্যের জন্য{' '}
                <span className="text-amber-300 underline decoration-amber-300/80 decoration-2 underline-offset-2 group-hover:text-amber-200">
                  এখানে ক্লিক করুন
                </span>
              </p>
              <ChevronRight className="h-5 w-5 shrink-0 animate-pulse text-amber-300" />
            </div>
          </div>
        </motion.button>
      </section>

      {/* ===== Donation dialog ===== */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl border-2 border-amber-200 bg-white p-0 sm:max-w-md">
          <div className="rounded-t-[22px] bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 px-5 py-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-base font-black text-white sm:text-lg">
                <HandCoins className="h-5 w-5" /> মায়ের পুজোয় সাহায্য করুন
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-amber-100">
                Pujo Fund Donation — every contribution makes Maa&apos;s Pujo grander
              </DialogDescription>
            </DialogHeader>
          </div>

          {step === 'amount' ? (
            <div className="px-5 py-5">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Select amount</p>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setAmount(p)
                      setCustom('')
                    }}
                    aria-pressed={amount === p}
                    className={`rounded-xl border-2 py-3 text-center text-base font-black transition-all ${
                      chosen === p
                        ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-inner'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50/50'
                    }`}
                  >
                    {formatINR(p)}
                  </button>
                ))}
                <div
                  className={`flex items-center rounded-xl border-2 px-2 transition-all ${
                    amount === null && custom !== '' && Number(custom) > 0
                      ? 'border-amber-500 bg-amber-50 shadow-inner'
                      : 'border-stone-200 bg-white focus-within:border-amber-400'
                  }`}
                >
                  <span className="text-sm font-bold text-stone-400">₹</span>
                  <Input
                    inputMode="numeric"
                    placeholder="Other"
                    value={custom}
                    onChange={(e) => {
                      setCustom(e.target.value.replace(/[^0-9]/g, ''))
                      setAmount(null)
                    }}
                    aria-label="Custom donation amount"
                    className="h-11 border-0 bg-transparent text-center text-base font-bold shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <Button
                disabled={!chosen || loadingQr}
                onClick={() => chosen && loadQr(chosen)}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-5 text-base font-bold text-white hover:from-amber-700 hover:to-amber-600"
              >
                {loadingQr ? 'Preparing scanner...' : chosen ? `Continue — Pay ${formatINR(chosen)}` : 'Select an amount'}
              </Button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-stone-400">
                পেমেন্ট PhonePe / GPay / Paytm — যেকোনো UPI app দিয়ে করা যাবে।
              </p>
            </div>
          ) : (
            <div className="px-5 py-5">
              {/* scanner */}
              <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-sm">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-500" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 p-2">
                      <QrCode className="h-5 w-5 text-emerald-700" />
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-stone-900">Scan &amp; Pay</h3>
                      <p className="text-[11px] text-stone-500">Any UPI app</p>
                    </div>
                  </div>
                  <p className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-black text-amber-700">
                    {formatINR(chosen || 0)}
                  </p>
                </div>

                <div className="mt-3 flex justify-center">
                  <div className="rounded-2xl border-4 border-emerald-500 bg-white p-2.5">
                    {qr ? (
                      <img src={qr} alt="UPI payment QR code" className="h-44 w-44 sm:h-52 sm:w-52" />
                    ) : (
                      <div className="flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                      </div>
                    )}
                  </div>
                </div>

                {upiId && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(upiId)
                      toast({ title: 'UPI ID copied!' })
                    }}
                    className="mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-stone-100 px-4 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-200"
                  >
                    <Copy className="h-3.5 w-3.5" /> {upiId}
                  </button>
                )}
                <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-stone-400">
                  <Wallet className="h-3.5 w-3.5" /> Pay exactly {formatINR(chosen || 0)} — note: “Pujo Donation”
                </p>
              </div>

              <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-center text-[11px] font-medium leading-relaxed text-amber-800">
                পেমেন্ট করার পর কমিটির যেকোনো সদস্যকে জানিয়ে দিন — আপনার সাহায্যের জন্য অনেক ধন্যবাদ!
              </p>

              <Button
                variant="ghost"
                onClick={() => setStep('amount')}
                className="mt-3 w-full rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-700"
              >
                <Undo2 className="mr-1.5 h-4 w-4" /> Change amount
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
