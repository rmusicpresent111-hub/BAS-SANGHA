'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import {
  BadgeIndianRupee,
  CalendarDays,
  ClipboardList,
  MapPin,
  Trophy,
  Users,
  Volleyball,
} from 'lucide-react'
import { useApp } from '@/lib/store'
import { apiFetch, clearToken } from '@/lib/api'
import { useCachedJson } from '@/lib/client-cache'
import type { TournamentRequestDto, EventDto, HomeData } from '@/lib/types'
import { ScreenHeader, Watermark, formatINR, Loading } from './common'
import { ExtraFields, RulesSection, buildExtraPayload, parseFormFields } from './event-form'
import { extraDataRows } from '@/lib/extra-data'
import PaymentFlow from './PaymentFlow'
import PaymentMethodChoice, { type PayMethod } from './PaymentMethodChoice'
import StatusCard from './StatusCard'
import TournamentReceipt from './TournamentReceipt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type Step = 'status' | 'form' | 'pay'

export default function TournamentScreen({ type }: { type: 'CRICKET' | 'FOOTBALL' }) {
  const { user, setView, setUser } = useApp()
  const { toast } = useToast()
  const [event, setEvent] = useState<EventDto | null>(null)
  const [feeLoaded, setFeeLoaded] = useState(false)
  const [existing, setExisting] = useState<TournamentRequestDto | null | undefined>(undefined)
  const [step, setStep] = useState<Step>('form')
  const [saving, setSaving] = useState(false)
  const [payMethod, setPayMethod] = useState<PayMethod>('QR')
  const [form, setForm] = useState({ teamName: '', address: '', phone: '' })
  const [extraValues, setExtraValues] = useState<Record<string, string>>({})

  const isCricket = type === 'CRICKET'
  const title = isCricket ? 'Cricket Tournament' : 'Football Tournament'

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/tournament-request?type=${type}`)
      if (res.status === 401) {
        // stale session — clear it so the auth screen actually shows
        clearToken()
        setUser(null)
        setView('auth')
        return
      }
      const data = await res.json()
      setExisting(data.request || null)
      if (data.request && data.request.status !== 'REJECTED') setStep('status')
    } catch {
      setExisting(null)
    }
  }, [type, setView])

  useEffect(() => {
    if (!user) return
    loadStatus()
  }, [user, loadStatus])

  // event + entry fee come from the shared cached home payload (instant on repeat visits)
  const { data: home } = useCachedJson<HomeData>('/api/public/home')
  useEffect(() => {
    const ev: EventDto | undefined = home?.events?.find((e: EventDto) => e.type === type)
    setEvent(ev || null)
    if (home) setFeeLoaded(true)
  }, [home, type])

  if (!user) return <Loading />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  /** form validation shared by both paths (QR pay / cash submit) */
  const validateForm = (): boolean => {
    if (!form.teamName.trim() || !form.address.trim()) {
      toast({ title: 'Please fill all fields', variant: 'destructive' })
      return false
    }
    if (!/^\d{10}$/.test(form.phone.trim())) {
      toast({ title: 'Please enter a valid 10-digit phone number', variant: 'destructive' })
      return false
    }
    // admin-defined extra fields (required ones must be filled)
    const built = buildExtraPayload(parseFormFields(event?.formFields), extraValues)
    if (!built.ok) {
      toast({ title: `"${built.missing}" — এই ঘরটি পূরণ করুন`, variant: 'destructive' })
      return false
    }
    // never enter the pay step before the real fee is known — otherwise the
    // UPI intent could be built with a wrong fallback amount
    if (!feeLoaded && payMethod !== 'CASH') {
      toast({ title: 'Entry fee load হচ্ছে... একটু অপেক্ষা করুন', variant: 'destructive' })
      return false
    }
    return true
  }

  const startPayment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    if (payMethod === 'CASH') {
      // no online payment — submit straight into the admin verification queue
      submitCash()
      return
    }
    setStep('pay')
  }

  const postRequest = async (payload: Record<string, unknown>): Promise<boolean> => {
    setSaving(true)
    try {
      const res = await apiFetch('/api/tournament-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || 'Submission failed', variant: 'destructive' })
        return false
      }
      await loadStatus()
      toast({ title: 'Team registered successfully! 🏆' })
      return true
    } catch {
      toast({ title: 'Something went wrong', variant: 'destructive' })
      return false
    } finally {
      setSaving(false)
    }
  }

  /** CASH path — no UTR, admin verifies the cash by hand */
  const submitCash = async () => {
    const built = buildExtraPayload(parseFormFields(event?.formFields), extraValues)
    if (!built.ok) return // validateForm already surfaced the missing field
    const extra = built.data ? { extraData: built.data } : {}
    const ok = await postRequest({ ...form, type, paymentMethod: 'CASH', ...extra })
    if (ok) setStep('status')
  }

  const submitUtr = async (utr: string): Promise<{ ok: boolean; error?: string }> => {
    const built = buildExtraPayload(parseFormFields(event?.formFields), extraValues)
    if (!built.ok) return { ok: false, error: `"${built.missing}" পূরণ করুন` }
    const extra = built.data ? { extraData: built.data } : {}
    const ok = await postRequest({ ...form, type, paymentMethod: 'QR', utr, ...extra })
    return ok ? { ok: true } : { ok: false, error: 'Submission failed' }
  }

  // server fallback (tournament-request route) is ₹500 — client must match,
  // or the displayed fee and the recorded fee disagree
  const fee = event?.fee ?? 500

  return (
    <div className="bg-club flex min-h-dvh flex-col">
      <ScreenHeader title={title} subtitle="B.A.S Sangha • Estd 2021" onBack={() => setView('home')} accent="blue" />

      {/* hero banner */}
      <div className="relative h-44 w-full overflow-hidden shadow-md sm:h-56">
        {event && (
          <Image src={event.bannerUrl} alt={title} fill priority className="object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h2 className="text-xl font-black text-white drop-shadow sm:text-2xl">{event?.title || `${title} 2025`}</h2>
          {event?.eventDate && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-200">
              <CalendarDays className="h-4 w-4" /> {event.eventDate}
            </p>
          )}
        </div>
      </div>

      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        {/* logo watermark */}
        <Watermark src="/logo.png" opacity={0.07} />

        {existing === undefined ? (
          <Loading />
        ) : step === 'status' && existing && existing.status === 'REJECTED' ? (
          <div className="relative z-10">
            <StatusCard
              status={existing.status}
              title={title}
              onReapply={() => {
                setForm({ teamName: existing.teamName, address: existing.address, phone: existing.phone })
                setStep('form')
              }}
              details={[
                { label: 'Team Name', value: existing.teamName },
                { label: 'Tournament', value: event?.title || title },
                { label: 'Phone', value: existing.phone },
                ...extraDataRows(existing.extraData),
              ]}
              note={existing.note}
            />
          </div>
        ) : step === 'status' && existing ? (
          <div className="relative z-10">
            <TournamentReceipt
              request={existing}
              eventTitle={event?.title || title}
              eventDate={event?.eventDate}
              venue={event?.venue}
            />
          </div>
        ) : step === 'pay' ? (
          <PaymentFlow
            title={`${title} Entry Fee`}
            amount={fee}
            note={`BAS ${title} Entry`}
            onSubmitUtr={submitUtr}
            onExpiredRefill={() => setStep('form')}
          />
        ) : (
          <div className="relative z-10 space-y-4">
            {/* event info */}
            {event && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs font-semibold text-blue-900 shadow-sm">
                <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                  <CalendarDays className="h-3.5 w-3.5 text-amber-600" /> {event.eventDate || 'Date TBA'}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                  <MapPin className="h-3.5 w-3.5 text-red-500" /> {event.venue || 'Club Ground'}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                  <BadgeIndianRupee className="h-3.5 w-3.5 text-emerald-600" /> Entry Fee {formatINR(event.fee)}
                </span>
              </div>
            )}

            {/* নিয়মাবলী (admin-editable in Events tab) */}
            <RulesSection text={event?.rules} tone="blue" />

            <form onSubmit={startPayment} className="space-y-4">
              <div className="space-y-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <h3 className="flex items-center gap-1.5 text-sm font-black text-stone-800">
                  {isCricket ? <Trophy className="h-4 w-4 text-blue-800" /> : <Volleyball className="h-4 w-4 text-blue-800" />}
                  {event?.formTitle || 'Team Registration'}
                </h3>
                <div className="space-y-1.5">
                  <Label>Team Name *</Label>
                  <Input value={form.teamName} onChange={set('teamName')} placeholder="Your team name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Address *</Label>
                  <Input value={form.address} onChange={set('address')} placeholder="Club / Village, Post, Dist" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number *</Label>
                  <Input value={form.phone} onChange={set('phone')} type="tel" inputMode="numeric" maxLength={10} placeholder="Captain's 10-digit number" />
                </div>
                {/* admin-defined extra fields */}
                <ExtraFields
                  fields={parseFormFields(event?.formFields)}
                  values={extraValues}
                  onChange={(label, v) => setExtraValues((s) => ({ ...s, [label]: v }))}
                />
                {/* admin note for this form (optional) */}
                {event?.formNote && (
                  <p className="rounded-xl bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-900">{event.formNote}</p>
                )}
                <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3.5">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-stone-700">
                    <Users className="h-4 w-4 text-stone-400" /> Entry Fee Amount
                  </p>
                  <p className="text-xl font-black text-emerald-700">{formatINR(fee)}</p>
                </div>
              </div>

              {/* payment method — QR/UPI or Cash (same choice on every paid flow) */}
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <PaymentMethodChoice value={payMethod} onChange={setPayMethod} amountText={formatINR(fee)} />
              </div>

              <Button type="submit" disabled={saving} className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-5 text-base font-bold text-white shadow-lg hover:from-emerald-700 hover:to-emerald-600">
                {payMethod === 'CASH' ? (
                  <>
                    <ClipboardList className="mr-1.5 h-5 w-5" /> Submit Registration (Cash)
                  </>
                ) : (
                  <>
                    <ClipboardList className="mr-1.5 h-5 w-5" /> Payment Now — {formatINR(fee)}
                  </>
                )}
              </Button>
              <p className="text-center text-[11px] text-stone-400">
                {payMethod === 'CASH'
                  ? 'কমিটির হাতে নগদ টাকা দিন — admin টাকা পেয়ে verify করে approve করবে'
                  : 'Next step: UPI app (GPay / PhonePe) payment with 5 minute countdown'}
              </p>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
