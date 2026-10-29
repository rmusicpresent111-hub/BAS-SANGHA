'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { CalendarDays, Droplet, HandHeart, MapPin, Phone, User } from 'lucide-react'
import { useApp } from '@/lib/store'
import { apiFetch, clearToken } from '@/lib/api'
import type { BloodRequestDto, EventDto } from '@/lib/types'
import { ScreenHeader, TiledWatermark, Loading } from './common'
import StatusCard from './StatusCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type Step = 'status' | 'form' | 'done'

const BENEFITS = [
  {
    title: 'এক ব্যাগ রক্ত = একটি জীবন',
    text: 'আপনার দেওয়া এক ব্যাগ রক্ত কারও বাবা, মা, সন্তান বা প্রিয়জনের জীবন বাঁচাতে পারে।',
  },
  {
    title: 'নতুন রক্ত তৈরি হয়',
    text: 'রক্তদানের ২৪-৪৮ ঘণ্টার মধ্যেই শরীরে নতুন রক্ত তৈরি হতে শুরু করে।',
  },
  {
    title: 'হৃদয়ন্ত্র সুস্থ থাকে',
    text: 'নিয়মিত রক্তদানে হার্ট অ্যাটাকের ঝুঁকি কমে এবং রক্ত চলাচল সচল থাকে।',
  },
  {
    title: 'বিনামূল্যে স্বাস্থ্য পরীক্ষা',
    text: 'রক্তদানের আগে রক্তের গ্রুপ, হিমোগ্লোবিন সহ বিনামূল্যে স্বাস্থ্য পরীক্ষা করা হয়।',
  },
]

export default function BloodScreen() {
  const { user, setView, setUser } = useApp()
  const { toast } = useToast()
  const [event, setEvent] = useState<EventDto | null>(null)
  const [existing, setExisting] = useState<BloodRequestDto | null | undefined>(undefined)
  const [step, setStep] = useState<Step>('form')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', phone: '' })

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/blood-request')
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
  }, [setView, setUser])

  useEffect(() => {
    if (!user) return
    loadStatus()
    setForm((f) => ({ ...f, name: f.name || user.name }))
    fetch('/api/public/home')
      .then((r) => r.json())
      .then((d) => {
        const ev: EventDto | undefined = d.events?.find((e: EventDto) => e.type === 'BLOOD')
        setEvent(ev || null)
      })
      .catch(() => {})
  }, [user, loadStatus])

  if (!user) return <Loading />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.address.trim()) {
      toast({ title: 'Please fill all fields', variant: 'destructive' })
      return
    }
    if (!/^\d{10}$/.test(form.phone.trim())) {
      toast({ title: 'Please enter a valid 10-digit phone number', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await apiFetch('/api/blood-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      await loadStatus()
      setStep('done')
      toast({ title: 'Thank you for pledging to donate blood! ❤️' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Submission failed', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-club flex min-h-screen flex-col">
      <ScreenHeader title="Blood Donation Camp" subtitle="রক্ত দিন — জীবন বাঁচান" onBack={() => setView('home')} accent="red" />

      {/* hero banner */}
      <div className="relative h-44 w-full overflow-hidden shadow-md sm:h-56">
        {event && <Image src={event.bannerUrl} alt="Blood Donation Camp" fill priority className="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h2 className="text-xl font-black text-white drop-shadow sm:text-2xl">{event?.title || 'Blood Donation Camp 2026'}</h2>
          {event?.eventDate && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-100">
              <CalendarDays className="h-4 w-4" /> {event.eventDate}
            </p>
          )}
        </div>
      </div>

      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        {/* blood photo watermark */}
        <TiledWatermark src="/images/blood-drop.png" opacity={0.06} />

        {existing === undefined ? (
          <Loading />
        ) : step === 'status' && existing ? (
          <StatusCard
            status={existing.status}
            title="Blood Donation"
            approvedLabel="Donor slot confirmed — see you at the camp, hero! ❤️"
            details={[
              { label: 'Name', value: existing.name },
              { label: 'Address', value: existing.address },
              { label: 'Phone', value: existing.phone },
              ...(event?.eventDate ? [{ label: 'Camp Date', value: event.eventDate }] : []),
              ...(event?.venue ? [{ label: 'Venue', value: event.venue }] : []),
            ]}
            note={existing.note}
          />
        ) : step === 'done' ? (
          <div className="relative z-10 rounded-3xl border border-red-200 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <HandHeart className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="mt-4 text-xl font-black text-stone-900">আপনি রক্তদানের অঙ্গীকার করেছেন! ❤️</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-stone-500">
              আপনার নাম ডোনার তালিকায় যুক্ত হয়েছে। ক্যাম্পের তারিখ ও সময় নিয়ে আমরা শীঘ্রই ফোনে যোগাযোগ করব।
            </p>
            <Button onClick={loadStatus} className="mt-5 rounded-full bg-gradient-to-r from-red-700 to-red-600 px-8 font-bold text-white">
              Check Status
            </Button>
          </div>
        ) : (
          <div className="relative z-10 space-y-5">
            {/* event info */}
            {event && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50/70 p-3.5 text-xs font-semibold text-red-900 shadow-sm">
                <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                  <CalendarDays className="h-3.5 w-3.5 text-red-600" /> {event.eventDate || 'Date TBA'}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                  <MapPin className="h-3.5 w-3.5 text-red-500" /> {event.venue || 'Community Hall'}
                </span>
              </div>
            )}

            {/* camp details — blood bank agency etc. (from admin) */}
            {event?.description && (
              <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
                <h3 className="flex items-center gap-1.5 text-sm font-black text-stone-800">
                  <Droplet className="h-4 w-4 fill-red-600 text-red-600" /> ক্যাম্পের খুঁটিনাটি
                </h3>
                <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-stone-700">{event.description}</p>
              </div>
            )}

            {/* benefits in Bengali */}
            <section aria-label="Blood donation benefits">
              <h3 className="mb-3 flex items-center gap-2 text-base font-black text-red-900">
                <Droplet className="h-5 w-5 fill-red-600 text-red-600" /> রক্তদানের উপকারিতা
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {BENEFITS.map((b, i) => (
                  <div key={i} className="flex gap-3 rounded-2xl border border-red-100 bg-white/90 p-4 shadow-sm backdrop-blur">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-black text-red-700">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-stone-900">{b.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-stone-600">{b.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* form */}
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-3.5 rounded-2xl border border-red-200 bg-white p-5 shadow-md">
                <h3 className="flex items-center gap-1.5 text-sm font-black text-stone-800">
                  <HandHeart className="h-4 w-4 text-red-600" /> Donor Registration
                </h3>
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={set('name')} placeholder="Your full name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Address *</Label>
                  <Input value={form.address} onChange={set('address')} placeholder="Village / Town, Post, Dist" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number *</Label>
                  <Input value={form.phone} onChange={set('phone')} type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit number" />
                </div>
                <p className="flex items-center gap-1.5 rounded-xl bg-red-50 p-3 text-[11px] leading-relaxed text-red-800">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> রক্তদানের যোগ্যতা: বয়স ১৮-৬০ বছর, ওজন ৪৫ কেজির বেশি, শেষ রক্তদানের পর ন্যূনতম ৩ মাস অতিক্রান্ত।
                </p>
              </div>

              <Button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-red-700 to-red-500 py-5 text-base font-bold text-white shadow-lg hover:from-red-800 hover:to-red-600">
                <User className="mr-1.5 h-5 w-5" /> {submitting ? 'Submitting...' : 'Donate Now'}
              </Button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
