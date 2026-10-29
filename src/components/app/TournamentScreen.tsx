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
import type { TournamentRequestDto, EventDto } from '@/lib/types'
import { ScreenHeader, Watermark, formatINR, Loading } from './common'
import PaymentFlow from './PaymentFlow'
import StatusCard from './StatusCard'
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
  const [form, setForm] = useState({ teamName: '', address: '', phone: '' })

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
    fetch('/api/public/home')
      .then((r) => r.json())
      .then((d) => {
        const ev: EventDto | undefined = d.events?.find((e: EventDto) => e.type === type)
        setEvent(ev || null)
      })
      .catch(() => setEvent(null))
      .finally(() => setFeeLoaded(true))
  }, [user, loadStatus, type])

  if (!user) return <Loading />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const startPayment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.teamName.trim() || !form.address.trim()) {
      toast({ title: 'Please fill all fields', variant: 'destructive' })
      return
    }
    if (!/^\d{10}$/.test(form.phone.trim())) {
      toast({ title: 'Please enter a valid 10-digit phone number', variant: 'destructive' })
      return
    }
    // never enter the pay step before the real fee is known — otherwise the
    // UPI intent could be built with a wrong fallback amount
    if (!feeLoaded) {
      toast({ title: 'Entry fee load হচ্ছে... একটু অপেক্ষা করুন', variant: 'destructive' })
      return
    }
    setStep('pay')
  }

  const submitUtr = async (utr: string): Promise<{ ok: boolean; error?: string }> => {
    setSaving(true)
    try {
      const res = await apiFetch('/api/tournament-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type, utr }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      await loadStatus()
      toast({ title: 'Team registered successfully! 🏆' })
      return { ok: true }
    } catch {
      return { ok: false, error: 'Something went wrong' }
    } finally {
      setSaving(false)
    }
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
        ) : step === 'status' && existing ? (
          <StatusCard
            status={existing.status}
            title={title}
            approvedLabel="Team ID — see you on the field, champions!"
            id={existing.status === 'APPROVED' ? `BAS-${isCricket ? 'CT' : 'FT'}-${existing.id.slice(-6).toUpperCase()}` : undefined}
            details={[
              { label: 'Team Name', value: existing.teamName },
              { label: 'Tournament', value: event?.title || title },
              { label: 'Date', value: event?.eventDate || 'To be announced' },
              { label: 'Venue', value: event?.venue || 'Dekchin Gobindapur Ground' },
              { label: 'Address', value: existing.address },
              { label: 'Phone', value: existing.phone },
              { label: 'Entry Fee Paid', value: formatINR(existing.fee) },
              { label: 'UTR Number', value: existing.utr },
            ]}
            note={existing.note}
          />
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

            <form onSubmit={startPayment} className="space-y-4">
              <div className="space-y-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <h3 className="flex items-center gap-1.5 text-sm font-black text-stone-800">
                  {isCricket ? <Trophy className="h-4 w-4 text-blue-800" /> : <Volleyball className="h-4 w-4 text-blue-800" />}
                  Team Registration
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
                <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3.5">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-stone-700">
                    <Users className="h-4 w-4 text-stone-400" /> Entry Fee Amount
                  </p>
                  <p className="text-xl font-black text-emerald-700">{formatINR(fee)}</p>
                </div>
              </div>

              <Button type="submit" className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-5 text-base font-bold text-white shadow-lg hover:from-emerald-700 hover:to-emerald-600">
                <ClipboardList className="mr-1.5 h-5 w-5" /> Payment Now — {formatINR(fee)}
              </Button>
              <p className="text-center text-[11px] text-stone-400">Next step: UPI app (GPay / PhonePe) payment with 5 minute countdown</p>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
