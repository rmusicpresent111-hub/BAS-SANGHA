'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  Copy,
  HandCoins,
  History,
  Loader2,
  QrCode,
  RotateCcw,
  Smartphone,
  TriangleAlert,
  Undo2,
  Wallet,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useApp } from '@/lib/store'
import { apiFetch } from '@/lib/api'
import { formatINR } from './common'
import DonationReceipt, { type DonationReceiptData } from './DonationReceipt'
import PaymentMethodChoice, { type PayMethod } from './PaymentMethodChoice'

const PRESETS = [51, 101, 251, 501, 1001]
const AMOUNT_MIN = 10
const AMOUNT_MAX = 100000

type Step = 'amount' | 'pay' | 'utr' | 'receipt'

interface OrderResponse {
  donation: DonationReceiptData
  upi: { upiId: string; upiName: string; upiIntent: string; qrDataUrl: string }
}

/** "Donate Now" payment flow — amount → UPI app → UTR → receipt. */
export default function DonationDialog() {
  const { donationOpen, setDonationOpen } = useApp()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>('amount')
  const [amount, setAmount] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [phone, setPhone] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod>('QR')
  const [creating, setCreating] = useState(false)
  const [order, setOrder] = useState<OrderResponse | null>(null)
  const [receipt, setReceipt] = useState<DonationReceiptData | null>(null)
  const [utr, setUtr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [history, setHistory] = useState<DonationReceiptData[] | null>(null)
  // return-detection from the UPI payment app (PhonePe/GPay/Paytm)
  const wentToUpi = useRef(false)
  const [returnPrompt, setReturnPrompt] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  const chosen = amount ?? (Number(custom) > 0 ? Number(custom) : null)
  const amountValid = chosen !== null && chosen >= AMOUNT_MIN && chosen <= AMOUNT_MAX

  const loadHistory = useCallback(() => {
    apiFetch('/api/donation/mine')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHistory(d?.donations || []))
      .catch(() => setHistory([]))
  }, [])

  useEffect(() => {
    if (donationOpen) loadHistory()
  }, [donationOpen, loadHistory])

  // When the user comes back from their payment app, ask what happened:
  // success → UTR step (instant receipt); failed → "Try again" re-opens the app.
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

  const reset = () => {
    setStep('amount')
    setAmount(null)
    setCustom('')
    setUtr('')
    setOrder(null)
    setReceipt(null)
    setPayMethod('QR')
    setReturnPrompt(false)
    setQrOpen(false)
    wentToUpi.current = false
  }

  const close = (v: boolean) => {
    setDonationOpen(v)
    if (!v) reset()
  }

  /** create a server-side order, then jump into the UPI app (mobile).
   *  CASH orders skip the payment app entirely — the receipt shows
   *  "under verification" until the admin confirms the cash. */
  const startPayment = async () => {
    if (!amountValid || creating) return
    setCreating(true)
    try {
      const res = await apiFetch('/api/donation/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: chosen, phone: phone.replace(/\D/g, ''), paymentMethod: payMethod }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Order failed')
      setOrder(data)
      if (payMethod === 'CASH') {
        setReceipt({ ...data.donation, utr: null })
        setStep('receipt')
        toast({ title: 'Cash donation জমা হয়েছে ✓', description: 'Admin টাকা পেয়ে verify করলে status update হবে' })
        loadHistory()
        return
      }
      setStep('pay')
      // deep-link into the user's UPI app (GPay / PhonePe / Paytm) — only on mobile
      if (/android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
        wentToUpi.current = true
        window.location.href = data.upi.upiIntent
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Order failed', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const openUpiApp = () => {
    if (!order) return
    wentToUpi.current = true
    window.location.href = order.upi.upiIntent
    toast({ title: 'Opening your payment app…', description: 'GPay / PhonePe / Paytm — যেটা আছে সেটাই খুলবে' })
  }

  const submitUtr = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!order || submitting) return
    if (!/^[A-Za-z0-9]{10,22}$/.test(utr.trim())) {
      toast({ title: 'Please enter a valid UTR number (10-22 characters)', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/donation/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.donation.orderId, utr: utr.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setReceipt({ ...order.donation, ...data.donation })
      setStep('receipt')
      loadHistory()
      toast({ title: 'Payment submitted ✓', description: 'Receipt ready — admin verify করলে status update হবে' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Submission failed', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={donationOpen} onOpenChange={close}>
      <DialogContent className="max-h-[92vh] max-w-sm overflow-y-auto rounded-3xl border-2 border-amber-200 bg-white p-0 sm:max-w-md">
        <div className="rounded-t-[22px] bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-base font-black text-white sm:text-lg">
              <HandCoins className="h-5 w-5" /> Donate Now
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-amber-100">
              মায়ের পুজো ও সমাজসেবায় সাহায্য করুন — QR / UPI অথবা Cash
            </DialogDescription>
          </DialogHeader>
        </div>

        {step === 'amount' && (
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
                  aria-pressed={chosen === p}
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
                  amount === null && custom !== '' ? 'border-amber-500 bg-amber-50 shadow-inner' : 'border-stone-200 bg-white focus-within:border-amber-400'
                }`}
              >
                <span className="text-sm font-bold text-stone-400">₹</span>
                <Input
                  inputMode="numeric"
                  maxLength={6}
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

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="don-phone" className="text-xs text-stone-500">
                Mobile number (receipt-এর জন্য, optional)
              </Label>
              <Input
                id="don-phone"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="h-10 rounded-xl border-stone-200 bg-stone-50"
              />
            </div>

            {/* payment method — QR/UPI or Cash (same choice on every paid flow) */}
            <div className="mt-4">
              <PaymentMethodChoice value={payMethod} onChange={setPayMethod} amountText={chosen ? formatINR(chosen) : undefined} />
            </div>

            <Button
              disabled={!amountValid || creating}
              onClick={startPayment}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-5 text-base font-bold text-white hover:from-amber-700 hover:to-amber-600"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating order...
                </>
              ) : payMethod === 'CASH' ? (
                <>
                  Submit Cash Donation {chosen ? `— ${formatINR(chosen)}` : ''} <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              ) : (
                <>
                  Continue — Pay {chosen ? formatINR(chosen) : ''} <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
            {chosen !== null && !amountValid && (
              <p className="mt-2 text-center text-[11px] font-semibold text-red-500">
                Amount ₹{AMOUNT_MIN} – ₹{AMOUNT_MAX.toLocaleString('en-IN')} এর মধ্যে হতে হবে
              </p>
            )}

            {/* my donations history (own records only) */}
            {history && history.length > 0 && (
              <div className="mt-5 border-t border-dashed border-stone-200 pt-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-stone-500">
                  <History className="h-3.5 w-3.5" /> আমার donations ({history.length})
                </p>
                <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {history.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setReceipt(d)
                        setStep('receipt')
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-left transition hover:bg-amber-50"
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-[10px] text-stone-400">{d.orderId}</span>
                        <span className="block text-[11px] font-bold text-stone-700">{formatINR(d.amount)}</span>
                      </span>
                      <StatusPill status={d.status} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'pay' && order && (
          <div className="px-5 py-5">
            {/* returned from payment app — ask payment status */}
            {returnPrompt && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 shadow-sm"
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
                  onClick={() => {
                    setReturnPrompt(false)
                    setStep('utr')
                  }}
                  className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-4 text-sm font-bold text-white hover:from-emerald-700 hover:to-emerald-600"
                >
                  <BadgeCheck className="mr-1.5 h-4 w-4" /> Payment হয়েছে ✓ — UTR জমাই
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setReturnPrompt(false)
                    openUpiApp()
                  }}
                  className="mt-2 w-full rounded-xl border-red-200 bg-white py-4 text-sm font-bold text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" /> Payment হয়নি — আবার Try করুন
                </Button>
              </motion.div>
            )}

            {/* primary action: open the payment app */}
            <button
              onClick={openUpiApp}
              className="group flex w-full items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-lime-50 p-4 text-left shadow-sm transition hover:border-emerald-300 active:scale-[0.99]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
                <Smartphone className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-stone-900">Pay {formatINR(order.donation.amount)} via UPI App</span>
                <span className="block text-[11px] text-stone-500">GPay • PhonePe • Paytm • BHIM — tap to open</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-emerald-600 transition-transform group-hover:translate-x-1" />
            </button>

            <div className="mt-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-amber-900">
              <p className="flex items-start gap-1.5">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>
                  Payment app-এ <b>Pay button দেখা না গেলে</b> — নিচে কোনো banner/notice থাকলে আগে <b>DISMISS</b> চাপুন, তারপর Pay button দেখাবে।
                </span>
              </p>
              <p className="mt-1.5 flex items-start gap-1.5">
                <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>
                  তবুও না হলে: নিচের UPI ID <b>copy</b> করুন → PhonePe/GPay-তে <b>“To UPI ID”</b> অপশনে paste করে pay করুন → ফিরে এসে UTR জমান।
                </span>
              </p>
            </div>

            {/* copyable UPI ID (fallback when the intent can't open) */}
            {order.upi.upiId && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(order.upi.upiId)
                  toast({ title: 'UPI ID copied!' })
                }}
                className="mx-auto mt-3 flex items-center gap-1.5 rounded-full bg-stone-100 px-4 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-200"
              >
                <Copy className="h-3.5 w-3.5" /> {order.upi.upiId}
              </button>
            )}

            {/* QR fallback — for apps whose UPI Risk Policy blocks deep links (Paytm) */}
            {order.upi.qrDataUrl && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setQrOpen((v) => !v)}
                  aria-expanded={qrOpen}
                  className="mx-auto flex items-center gap-1.5 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-200"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  {qrOpen ? 'QR লুকান' : 'Paytm-এ alert দেখলে — QR scan করুন'}
                </button>
                {qrOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="mx-auto w-fit rounded-2xl border-2 border-amber-200 bg-white p-3 shadow-sm">
                      <img
                        src={order.upi.qrDataUrl}
                        alt={`UPI payment QR code for ${order.donation.orderId}`}
                        className="h-44 w-44 rounded-lg"
                      />
                      <p className="mt-2 max-w-[190px] text-center text-[10px] font-medium leading-relaxed text-stone-500">
                        যেকোনো UPI app দিয়ে scan করুন — {formatINR(order.donation.amount)} auto-filled থাকবে
                      </p>
                    </div>
                    <p className="mx-auto mt-2 flex max-w-xs items-start gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-center text-[10px] font-medium leading-relaxed text-blue-900">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Paytm-এ “Payment Alert / UPI Risk Policy” দেখলে ভয় পাবেন না — ওটা Paytm-এর নিজের security warning। GPay বা PhonePe দিয়ে pay করুন, অথবা উপরের QR scan করুন।
                    </p>
                  </motion.div>
                )}
              </div>
            )}

            <div className="mt-4 rounded-xl bg-blue-50 px-3 py-2.5 text-center text-[11px] font-medium leading-relaxed text-blue-900">
              Order ID: <span className="font-mono font-bold">{order.donation.orderId}</span> — UPI app-এ এই amount টাই pay করুন।
            </div>

            <Button
              onClick={() => setStep('utr')}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-5 text-base font-bold text-white hover:from-emerald-700 hover:to-emerald-600"
            >
              <Wallet className="mr-2 h-4 w-4" /> পেমেন্ট হয়েছে — UTR জমাই
            </Button>
            <Button
              variant="ghost"
              onClick={() => setStep('amount')}
              className="mt-2 w-full rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-700"
            >
              <Undo2 className="mr-1.5 h-4 w-4" /> Amount বদলাই
            </Button>
          </div>
        )}

        {step === 'utr' && order && (
          <form onSubmit={submitUtr} className="px-5 py-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm font-black text-stone-800">
                UTR number দিন <span className="text-stone-400">({formatINR(order.donation.amount)})</span>
              </p>
              <Input
                autoFocus
                value={utr}
                onChange={(e) => setUtr(e.target.value.toUpperCase())}
                placeholder="e.g. 423188905567"
                aria-label="UTR number"
                maxLength={22}
                className="mt-3 h-12 rounded-xl border-2 border-amber-300 bg-white text-center text-lg font-bold tracking-widest placeholder:font-normal placeholder:tracking-normal placeholder:text-stone-300 focus-visible:ring-amber-400"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
                UPI app-এ payment successful হলে &quot;UPI Transaction ID / UTR&quot; দেখতে পাবেন — সেটাই এখানে লিখুন। প্রতিটি UTR একবারই ব্যবহার করা যাবে।
              </p>
              <Button
                type="submit"
                disabled={submitting || !utr.trim()}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-5 text-base font-bold text-white hover:from-emerald-700 hover:to-emerald-600"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  'Submit & Generate Receipt'
                )}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep('pay')}
              className="mt-3 w-full rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-700"
            >
              <Undo2 className="mr-1.5 h-4 w-4" /> Back to payment
            </Button>
          </form>
        )}

        {step === 'receipt' && receipt && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="px-5 py-5">
            <DonationReceipt donation={receipt} />
            <Button
              variant="ghost"
              onClick={() => {
                reset()
                setDonationOpen(false)
              }}
              className="mt-3 w-full rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-700"
            >
              Close
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-stone-100 text-stone-500',
    SUBMITTED: 'bg-amber-100 text-amber-700',
    VERIFIED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-600',
  }
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${map[status] || map.PENDING}`}>
      {status}
    </span>
  )
}
