'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Copy,
  Hourglass,
  QrCode,
  RotateCcw,
  Smartphone,
  Timer,
  TriangleAlert,
  Wallet,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatINR } from './common'

const TOTAL_SEC = 240 // 4 minutes

/** PhonePe-style sample screenshot mock (shows where the UTR number is). */
function SampleShot({ index, amount }: { index: number; amount: number }) {
  const utrs = [
    '4231 8890 5567',
    '9012 4453 7781',
    '3345 6721 0984',
  ]
  const utr = utrs[index % utrs.length]
  return (
    <div className="w-44 shrink-0 snap-center rounded-2xl border border-stone-200 bg-white shadow-md sm:w-48">
      {/* fake status bar */}
      <div className="flex items-center justify-between rounded-t-2xl bg-[#5f259f] px-3 py-1.5">
        <span className="text-[9px] font-bold text-white">{['PhonePe', 'GPay', 'Paytm'][index % 3]}</span>
        <span className="text-[8px] text-white/80">10:30 AM</span>
      </div>
      <div className="flex flex-col items-center gap-1 px-3 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="text-[11px] font-bold text-stone-800">Payment Successful</p>
        <p className="text-lg font-black text-stone-900">{formatINR(amount)}</p>
        <p className="text-[9px] text-stone-500">Paid to B.A.S Sangha</p>
        <div className="mt-1.5 w-full rounded-lg bg-stone-50 p-2">
          <p className="text-[8px] font-medium uppercase tracking-wide text-stone-400">UPI Transaction ID (UTR)</p>
          <p className="mt-0.5 text-center text-[11px] font-black tracking-wide text-amber-600">{utr}</p>
          <div className="mt-1 border-t border-dashed border-stone-200 pt-1 text-center">
            <span className="text-[8px] font-semibold text-stone-400">↑ copy this number ↑</span>
          </div>
        </div>
        <p className="mt-1 text-center text-[9px] font-bold text-stone-400">Sample {index + 1}</p>
      </div>
    </div>
  )
}

export default function PaymentFlow({
  title,
  amount,
  note,
  onSubmitUtr,
  onExpiredRefill,
  onReceived,
}: {
  title: string
  amount: number
  note: string
  onSubmitUtr: (utr: string) => Promise<{ ok: boolean; error?: string }>
  onExpiredRefill: () => void
  /** called when the user taps "Status দেখুন" on the Payment Received screen */
  onReceived?: () => void
}) {
  const { toast } = useToast()
  const [upiId, setUpiId] = useState('')
  const [upiIntent, setUpiIntent] = useState('')
  const [qr, setQr] = useState('')
  const [seconds, setSeconds] = useState(TOTAL_SEC)
  const [expired, setExpired] = useState(false)
  const [utr, setUtr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [received, setReceived] = useState(false) // UTR accepted → "Payment Received" screen
  const [submittedUtr, setSubmittedUtr] = useState('')
  // return-detection from the UPI payment app (PhonePe/GPay/Paytm)
  const wentToUpi = useRef(false)
  const [returnPrompt, setReturnPrompt] = useState(false)

  // load payee details + UPI deep link (server-issued, validated inputs).
  // Re-runs when amount/note change so the intent ALWAYS matches the displayed
  // fee — a late-loading event fee must never leave a stale amount in the
  // payment app (user would pay the wrong sum).
  useEffect(() => {
    let dead = false
    const load = () => {
      fetch(`/api/public/upi-info?amount=${amount}&note=${encodeURIComponent(note)}`)
        .then(async (r) => {
          const d = await r.json()
          if (!r.ok || d.error) throw new Error(d.error || 'Failed to load payment details')
          return d
        })
        .then((d) => {
          if (dead) return
          setUpiId(d.upiId || '')
          setUpiIntent(d.upiIntent || '')
          setQr(d.qrDataUrl || '')
        })
        .catch(() => {
          if (dead) return
          setUpiId('')
          setUpiIntent('')
          setQr('')
          toast({ title: 'Could not load payment details', variant: 'destructive' })
        })
    }
    load()
    const t = setInterval(load, 60_000) // auto-refresh intent (session may expire server-side)
    return () => {
      dead = true
      clearInterval(t)
    }
  }, [amount, note, toast])

  // When the user comes back from their payment app, ask what happened:
  // success → focus the UTR form; failed → "Try again" re-opens the app.
  useEffect(() => {
    const checkReturn = () => {
      if (wentToUpi.current) {
        wentToUpi.current = false
        setReturnPrompt(true)
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') checkReturn()
    }
    const onPageShow = () => checkReturn()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  // countdown (paused once the payment is received — the page is done)
  useEffect(() => {
    if (expired || received) return
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(t)
          setExpired(true)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [expired, received])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  const danger = seconds <= 60

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[A-Za-z0-9]{10,22}$/.test(utr.trim())) {
      toast({ title: 'Please enter a valid UTR number', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    const result = await onSubmitUtr(utr.trim())
    setSubmitting(false)
    if (result.ok) {
      setSubmittedUtr(utr.trim())
      setReceived(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      toast({ title: result.error || 'Submission failed', variant: 'destructive' })
    }
  }

  /* ---------- PAYMENT RECEIVED — UTR accepted, admin review pending ---------- */
  if (received) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 via-white to-white p-8 text-center shadow-lg"
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-500" />
        <motion.span
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 shadow-inner"
        >
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </motion.span>
        <h3 className="mt-4 text-2xl font-black text-emerald-900">Payment Received ✓</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-relaxed text-emerald-700">
          আপনার payment সফলভাবে জমা হয়েছে — {title} ({formatINR(amount)})
        </p>
        <div className="mx-auto mt-4 w-fit rounded-xl bg-white px-5 py-2.5 shadow-sm ring-1 ring-emerald-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">UTR Number</p>
          <p className="font-mono text-sm font-black tracking-widest text-stone-800">{submittedUtr}</p>
        </div>
        <p className="mx-auto mt-4 max-w-xs text-[11px] leading-relaxed text-stone-500">
          এখন admin verification-এর অপেক্ষায় — approve/reject হলে আপনার status এখানেই দেখতে পাবেন।
        </p>
        {onReceived && (
          <Button
            onClick={onReceived}
            className="mt-5 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 px-8 py-5 font-bold text-white shadow-md hover:from-emerald-700 hover:to-emerald-600"
          >
            আপনার Status দেখুন <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        )}
      </motion.div>
    )
  }

  /* ---------- EXPIRED ---------- */
  if (expired) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center shadow-inner">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <TriangleAlert className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="mt-4 text-xl font-black text-red-800">Page Expired!</h3>
        <p className="mx-auto mt-2 max-w-xs text-sm text-red-600">
          The 4 minute payment window is over. Please fill up the form again to start a new payment.
        </p>
        <Button onClick={onExpiredRefill} className="mt-5 rounded-full bg-gradient-to-r from-red-700 to-red-600 px-8 font-bold text-white hover:from-red-800 hover:to-red-700">
          Fill Form Again
        </Button>
      </motion.div>
    )
  }

  return (
    <div className="space-y-5">
      {/* payment card — scanner + UPI ID, 4-minute countdown */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-200 bg-white p-5 shadow-lg">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-500" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 p-2">
              <QrCode className="h-5 w-5 text-emerald-700" />
            </span>
            <div>
              <h3 className="text-sm font-black text-stone-900">Scan & Pay</h3>
              <p className="text-[11px] text-stone-500">{title}</p>
            </div>
          </div>
          {/* 4-minute countdown */}
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-black tabular-nums ${danger ? 'animate-pulse bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            <Timer className="h-4 w-4" />
            <span className="text-sm">{mm}:{ss}</span>
          </div>
        </div>

        <p className="mt-3 text-center text-3xl font-black tracking-tight text-stone-900">{formatINR(amount)}</p>

        {/* QR scanner — always visible, viewfinder style */}
        {qr && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-4">
            <div className="relative mx-auto w-fit rounded-xl bg-white p-2.5 shadow-md ring-2 ring-emerald-200">
              {/* scanner corner brackets */}
              <span aria-hidden className="absolute -left-1.5 -top-1.5 h-5 w-5 rounded-tl-md border-l-[3px] border-t-[3px] border-emerald-600" />
              <span aria-hidden className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-tr-md border-r-[3px] border-t-[3px] border-emerald-600" />
              <span aria-hidden className="absolute -bottom-1.5 -left-1.5 h-5 w-5 rounded-bl-md border-b-[3px] border-l-[3px] border-emerald-600" />
              <span aria-hidden className="absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-br-md border-b-[3px] border-r-[3px] border-emerald-600" />
              <img src={qr} alt="UPI payment QR code — amount pre-filled" className="h-48 w-48 rounded-lg" />
              {/* moving scan line */}
              <motion.span
                aria-hidden
                initial={{ top: '8%' }}
                animate={{ top: ['8%', '88%', '8%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-x-3 h-0.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgb(16_185_129/0.8)]"
              />
            </div>
            <p className="mx-auto mt-2.5 max-w-xs text-center text-[11px] font-semibold leading-relaxed text-stone-500">
              যেকোনো UPI app (PhonePe / GPay / Paytm) দিয়ে এই QR <b>scan</b> করুন — {formatINR(amount)} auto-filled থাকবে
            </p>
          </motion.div>
        )}

        {/* UPI ID — tap to copy */}
        {upiId && (
          <button
            onClick={() => {
              navigator.clipboard?.writeText(upiId)
              toast({ title: 'UPI ID copied!' })
            }}
            className="mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-stone-100 px-4 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-200"
          >
            <Copy className="h-3.5 w-3.5" /> {upiId}
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700">TAP TO COPY</span>
          </button>
        )}

        {upiIntent && (
          <Button
            type="button"
            onClick={() => {
              wentToUpi.current = true
              window.location.href = upiIntent
              toast({ title: 'Opening your payment app…', description: 'GPay / PhonePe / Paytm — যেটা আছে সেটাই খুলবে' })
            }}
            className="mx-auto mt-4 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-4 text-sm font-bold text-white shadow-md hover:from-emerald-700 hover:to-emerald-600 active:scale-[0.99]"
          >
            <Smartphone className="mr-2 h-5 w-5" /> না হলে — UPI App-এ সরাসরি Pay করুন
          </Button>
        )}

        {/* troubleshooting tip — PhonePe sometimes covers the Pay button with a banner */}
        <div className="mt-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-amber-900">
          <p className="flex items-start gap-1.5">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>
              UPI app-এ <b>Pay button দেখা না গেলে</b> — নিচে কোনো banner/notice থাকলে আগে <b>DISMISS</b> চাপুন, তারপর Pay button দেখাবে।
            </span>
          </p>
          <p className="mt-1.5 flex items-start gap-1.5">
            <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>
              তবুও না হলে: উপরের UPI ID <b>copy</b> করুন → PhonePe/GPay-তে <b>“To UPI ID”</b> অপশনে paste করে pay করুন → ফিরে এসে UTR জমান।
            </span>
          </p>
        </div>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-stone-400">
          <Wallet className="h-3.5 w-3.5" /> আপনার payment app-এ {formatINR(amount)} pay করুন — payment successful হলে UTR number পাবেন
        </p>
      </div>

      {/* returned from payment app — ask payment status */}
      {returnPrompt && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-black text-emerald-900">📱 Payment app থেকে ফিরে এসেছেন</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setReturnPrompt(false)}
              className="rounded-full p-1 text-emerald-400 transition hover:bg-emerald-100 hover:text-emerald-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-0.5 text-[11px] font-medium text-emerald-700">Payment কেমন হলো?</p>
          <Button
            type="button"
            onClick={() => {
              setReturnPrompt(false)
              const el = document.getElementById('utr') as HTMLInputElement | null
              el?.focus()
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-4 text-sm font-bold text-white hover:from-emerald-700 hover:to-emerald-600"
          >
            <BadgeCheck className="mr-1.5 h-4 w-4" /> Payment হয়েছে ✓ — নিচে UTR জমাই
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setReturnPrompt(false)
              if (upiIntent) {
                wentToUpi.current = true
                window.location.href = upiIntent
              }
            }}
            className="mt-2 w-full rounded-xl border-red-200 bg-white py-4 text-sm font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" /> Payment হয়নি — আবার Try করুন
          </Button>
        </motion.div>
      )}

      {/* UTR form */}
      <form onSubmit={submit} className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
        <Label htmlFor="utr" className="flex items-center gap-1.5 text-sm font-bold text-stone-800">
          <Wallet className="h-4 w-4 text-amber-600" /> Please enter UTR number
        </Label>
        <Input
          id="utr"
          value={utr}
          onChange={(e) => setUtr(e.target.value)}
          placeholder="e.g. 423188905567"
          className="mt-2 h-12 rounded-xl border-2 border-amber-300 bg-white text-center text-lg font-bold tracking-widest placeholder:font-normal placeholder:tracking-normal placeholder:text-stone-300 focus-visible:ring-amber-400"
          maxLength={22}
        />
        <p className="mt-1.5 text-[11px] text-stone-500">
          UTR number payment screenshot এর নিচে দেখানো sample গুলোর মতো — পেমেন্ট সফল হলে আপনার UPI app এ UPI Transaction ID হিসেবে পাবেন।
        </p>
        <Button
          type="submit"
          disabled={submitting}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-5 text-base font-bold text-white hover:from-emerald-700 hover:to-emerald-600"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </Button>

        {/* samples */}
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
            <BadgeCheck className="h-4 w-4 text-emerald-600" />
            UTR number কোথায় পাবেন? নিচের ৩টি sample দেখুন
          </p>
          <div className="no-scrollbar mt-2 flex snap-x gap-3 overflow-x-auto pb-2">
            {[0, 1, 2].map((i) => (
              <SampleShot key={i} index={i} amount={amount} />
            ))}
          </div>
        </div>
      </form>

      <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[11px] text-stone-400">
        <Hourglass className="h-3.5 w-3.5" /> Submit করলেই “Payment Received” দেখাবে — তারপর admin approve/reject করলে status এখানেই আসবে।
      </p>
    </div>
  )
}
