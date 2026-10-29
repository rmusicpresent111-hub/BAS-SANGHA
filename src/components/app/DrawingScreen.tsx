'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { CalendarDays, FileUp, MapPin, Palette, PartyPopper, Phone, Send, Wallet, X } from 'lucide-react'
import { useApp } from '@/lib/store'
import { apiFetch, clearToken } from '@/lib/api'
import { useCachedJson } from '@/lib/client-cache'
import type { DrawingRequestDto, EventDto, HomeData } from '@/lib/types'
import { ScreenHeader, Watermark, Loading, formatINR } from './common'
import StatusCard from './StatusCard'
import DrawingReceipt from './DrawingReceipt'
import PaymentFlow from './PaymentFlow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type Step = 'status' | 'form' | 'done'

export default function DrawingScreen() {
  const { user, setView, setUser } = useApp()
  const { toast } = useToast()
  const [event, setEvent] = useState<EventDto | null>(null)
  const [existing, setExisting] = useState<DrawingRequestDto | null | undefined>(undefined)
  const [step, setStep] = useState<Step>('form')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [payKey, setPayKey] = useState(0) // remount PaymentFlow for a fresh timer after expiry
  const [form, setForm] = useState({ name: '', fatherName: '', className: '', schoolName: '', phone: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const loadStatus = useCallback(async (): Promise<DrawingRequestDto | null> => {
    try {
      const res = await apiFetch('/api/drawing-request')
      if (res.status === 401) {
        // stale session — clear it so the auth screen actually shows
        clearToken()
        setUser(null)
        setView('auth')
        return null
      }
      const data = await res.json()
      setExisting(data.request || null)
      if (data.request && data.request.status !== 'REJECTED') setStep('status')
      return data.request || null
    } catch {
      setExisting(null)
      return null
    }
  }, [setView, setUser])

  useEffect(() => {
    if (!user) return
    loadStatus()
    setForm((f) => ({ ...f, name: f.name || user.name }))
  }, [user, loadStatus])

  // event comes from the shared cached home payload (instant on repeat visits)
  const { data: home } = useCachedJson<HomeData>('/api/public/home')
  useEffect(() => {
    const ev: EventDto | undefined = home?.events?.find((e: EventDto) => e.type === 'DRAWING')
    setEvent(ev || null)
  }, [home])

  // release the preview blob when leaving the screen
  useEffect(() => {
    return () => {
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [])

  if (!user) return <Loading />

  // server charges event fee when the admin set one, otherwise ₹30 — mirrored client-side for display
  const displayFee = event?.fee && event.fee > 0 ? event.fee : 30

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    if (f) {
      if (f.size > 8 * 1024 * 1024) {
        toast({ title: 'File too large (max 8MB)', variant: 'destructive' })
        return
      }
      setFile(f)
      // release the previous blob URL before replacing it (no leak on re-pick)
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return f.type.startsWith('image/') ? URL.createObjectURL(f) : null
      })
    }
  }

  const clearFile = () => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  /** STEP 1 — save the form (entry becomes UNPAID), then show the payment step. */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.fatherName.trim() || !form.className.trim() || !form.schoolName.trim()) {
      toast({ title: 'Please fill all fields', variant: 'destructive' })
      return
    }
    if (!/^\d{10}$/.test(form.phone.trim())) {
      toast({ title: 'Please enter a valid 10-digit mobile number', variant: 'destructive' })
      return
    }
    if (!file) {
      toast({ title: 'Please upload Aadhaar card or birth certificate', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('name', form.name)
      fd.set('fatherName', form.fatherName)
      fd.set('className', form.className)
      fd.set('schoolName', form.schoolName)
      fd.set('phone', form.phone)
      fd.set('doc', file)
      const res = await apiFetch('/api/drawing-request', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      await loadStatus()
      setStep('status')
      toast({ title: 'Entry saved! এখন payment করুন 🎨' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Submission failed', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  /** STEP 2 — UTR submitted from the PaymentFlow; entry goes into the admin queue. */
  const submitUtr = async (utr: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await apiFetch('/api/drawing-request/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utr }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      await loadStatus()
      setStep('status')
      toast({ title: 'Payment submitted! Admin approval-এর জন্য অপেক্ষা করুন ✓' })
      return { ok: true }
    } catch {
      return { ok: false, error: 'Something went wrong' }
    }
  }

  /** Discard the UNPAID entry and go back to a blank form. */
  const discardUnpaid = async () => {
    try {
      const res = await apiFetch('/api/drawing-request', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      setExisting(null)
      setStep('form')
      toast({ title: 'Entry বাতিল হয়েছে — নতুন করে ফর্ম পূরণ করুন' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    }
  }

  /* ---------- status-dependent views ---------- */

  const renderStatusView = (r: DrawingRequestDto) => {
    if (r.status === 'UNPAID') {
      return (
        <div className="space-y-5">
          <div className="rounded-3xl border border-amber-200 bg-gradient-to-b from-amber-50 via-white to-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100">
                <Wallet className="h-6 w-6 text-amber-600" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-black text-stone-900">Form জমা হয়েছে ✓ — এবার Payment</h3>
                <p className="text-xs font-medium text-stone-500">
                  Entry fee {formatINR(r.fee || displayFee)} pay করে UTR number জমা দিলে আবেদন admin-এর কাছে যাবে।
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1 rounded-2xl bg-stone-50 p-3.5">
              {[
                { label: 'Name', value: r.name },
                { label: "Father's Name", value: r.fatherName },
                { label: 'Class', value: r.className },
                { label: 'School', value: r.schoolName },
                { label: 'Mobile', value: r.phone },
              ].map((d) => (
                <div key={d.label} className="flex items-start justify-between gap-3 text-sm">
                  <span className="shrink-0 text-stone-500">{d.label}</span>
                  <span className="text-right font-semibold text-stone-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          <PaymentFlow
            key={payKey}
            title="Drawing Competition Entry Fee"
            amount={r.fee || displayFee}
            note={`Drawing Entry — ${r.name}`}
            onSubmitUtr={submitUtr}
            onExpiredRefill={() => setPayKey((k) => k + 1)}
          />

          <Button
            variant="outline"
            onClick={discardUnpaid}
            className="w-full rounded-xl border-red-200 text-sm font-bold text-red-600 hover:bg-red-50"
          >
            <X className="mr-1.5 h-4 w-4" /> ফর্ম আবার পূরণ করতে চাই (entry বাতিল)
          </Button>
        </div>
      )
    }

    if (r.status === 'APPROVED') {
      return (
        <div className="space-y-5">
          {/* approval banner */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 via-white to-white p-6 text-center shadow-lg">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-500" />
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 shadow-inner">
                <PartyPopper className="h-8 w-8 text-emerald-600" />
              </span>
              <h2 className="mt-3 text-2xl font-black text-emerald-900">Approved! 🎉</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm font-medium leading-relaxed text-emerald-700">
                {r.name}-এর Drawing Competition entry confirm হয়েছে — event দিন রঙ-ব্রাশ নিয়ে এসুন!
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600">
                <Palette className="h-3.5 w-3.5" /> নিচে আপনার payment receipt — download বা share করতে পারবেন
              </p>
            </div>
            {event?.eventDate || event?.venue ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {event?.eventDate && (
                  <span className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-stone-700 ring-1 ring-stone-200">
                    <CalendarDays className="h-3.5 w-3.5 text-amber-600" /> {event.eventDate}
                  </span>
                )}
                {event?.venue && (
                  <span className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-stone-700 ring-1 ring-stone-200">
                    <MapPin className="h-3.5 w-3.5 text-red-500" /> {event.venue}
                  </span>
                )}
              </div>
            ) : null}
          </motion.div>

          {/* payment receipt — download + share */}
          {r.utr && (
            <DrawingReceipt
              entry={{
                id: r.id,
                name: r.name,
                fatherName: r.fatherName,
                className: r.className,
                schoolName: r.schoolName,
                phone: r.phone,
                fee: r.fee,
                utr: r.utr,
                status: r.status,
                createdAt: r.createdAt,
              }}
            />
          )}
        </div>
      )
    }

    // WAITING (paid, admin review) — classic status card
    return (
      <StatusCard
        status="WAITING"
        title="Drawing Competition"
        details={[
          { label: 'Name', value: r.name },
          { label: "Father's Name", value: r.fatherName },
          { label: 'Class', value: r.className },
          { label: 'School', value: r.schoolName },
          { label: 'Mobile', value: r.phone },
          { label: 'Entry Fee Paid', value: formatINR(r.fee || 0) },
          ...(r.utr ? [{ label: 'UTR Number', value: r.utr }] : []),
          ...(event?.eventDate ? [{ label: 'Date', value: event.eventDate }] : []),
          ...(event?.venue ? [{ label: 'Venue', value: event.venue }] : []),
        ]}
        note={r.note}
      />
    )
  }

  return (
    <div className="bg-club flex min-h-dvh flex-col">
      <ScreenHeader title="Drawing Competition" subtitle="B.A.S Sangha • Estd 2021" onBack={() => setView('home')} accent="amber" />

      {/* hero banner */}
      <div className="relative h-44 w-full overflow-hidden shadow-md sm:h-56">
        {event && <Image src={event.bannerUrl} alt="Drawing Competition" fill priority className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h2 className="text-xl font-black text-white drop-shadow sm:text-2xl">{event?.title || 'Drawing Competition 2026'}</h2>
          {event?.eventDate && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-100">
              <CalendarDays className="h-4 w-4" /> {event.eventDate}
            </p>
          )}
        </div>
      </div>

      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        <Watermark src="/logo.png" opacity={0.07} />

        {existing === undefined ? (
          <Loading />
        ) : step === 'status' && existing ? (
          renderStatusView(existing)
        ) : step === 'done' ? (
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <PartyPopper className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-xl font-black text-stone-900">Entry Submitted!</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-stone-500">
              আপনার Drawing Competition entry সফলভাবে জমা হয়েছে। Admin approval এর পরেই event এর সব খবর জানানো হবে।
            </p>
            <Button onClick={loadStatus} className="mt-5 rounded-full bg-gradient-to-r from-blue-900 to-blue-700 px-8 font-bold text-white">
              Check Status
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="relative z-10 space-y-4">
            {event && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs font-semibold text-stone-800 shadow-sm">
                <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                  <CalendarDays className="h-3.5 w-3.5 text-amber-600" /> {event.eventDate || 'Date TBA'}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                  <MapPin className="h-3.5 w-3.5 text-red-500" /> {event.venue || 'Community Hall'}
                </span>
                <span className="rounded-full bg-amber-600 px-3 py-1 text-white shadow-sm">
                  Entry Fee {formatINR(displayFee)}
                </span>
              </div>
            )}

            {/* group / topic details (from the official poster) */}
            {event?.description && (
              <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
                <h3 className="flex items-center gap-1.5 text-sm font-black text-stone-800">
                  <Palette className="h-4 w-4 text-amber-600" /> বিভাগ ও বিষয়
                </h3>
                <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-stone-700">{event.description}</p>
              </div>
            )}

            <div className="space-y-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-1.5 text-sm font-black text-stone-800">
                <Palette className="h-4 w-4 text-amber-600" /> Participant Details
              </h3>
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={set('name')} placeholder="Participant's full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Father&apos;s Name *</Label>
                <Input value={form.fatherName} onChange={set('fatherName')} placeholder="Father's full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Class *</Label>
                  <Input value={form.className} onChange={set('className')} placeholder="e.g. Class V" />
                </div>
                <div className="space-y-1.5">
                  <Label>School Name *</Label>
                  <Input value={form.schoolName} onChange={set('schoolName')} placeholder="School name" />
                </div>
              </div>

              {/* mobile number — used for event updates + printed on the receipt */}
              <div className="space-y-1.5">
                <Label>Mobile Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    value={form.phone}
                    onChange={set('phone')}
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    className="pl-9"
                  />
                </div>
              </div>

              {/* document upload */}
              <div className="space-y-1.5">
                <Label>Upload Aadhaar Card / Birth Certificate *</Label>
                {!file ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 px-4 py-6 text-center transition hover:border-amber-400 hover:bg-amber-50"
                  >
                    <FileUp className="h-8 w-8 text-amber-500" />
                    <span className="text-sm font-semibold text-stone-700">Tap to upload</span>
                    <span className="text-[11px] text-stone-400">JPG / PNG / PDF — max 8MB</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                    {preview ? (
                      
                      <img src={preview} alt="Document preview" className="h-14 w-14 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-red-50 text-[10px] font-black text-red-600">PDF</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-800">{file.name}</p>
                      <p className="text-[11px] text-stone-400">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={clearFile} aria-label="Remove file" className="rounded-full text-stone-400 hover:text-red-600">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={pickFile} className="hidden" aria-label="Upload document" />
              </div>
            </div>

            <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-center text-[11px] font-semibold leading-relaxed text-amber-900">
              ℹ️ Submit করার পর {formatINR(displayFee)} entry fee pay করে UTR number জমা দিতে হবে — তারপর admin approval-এ যাবে।
            </p>

            <Button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-5 text-base font-bold text-white shadow-lg hover:from-amber-700 hover:to-amber-600">
              <Send className="mr-1.5 h-5 w-5" /> {submitting ? 'Submitting...' : 'Submit & Continue to Payment'}
            </Button>
          </form>
        )}
      </main>
    </div>
  )
}
