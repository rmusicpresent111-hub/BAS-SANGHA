'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BadgeIndianRupee, IdCard, ImagePlus, Lock, PartyPopper, Phone, UserPlus, X } from 'lucide-react'
import { useApp } from '@/lib/store'
import { apiFetch, clearToken } from '@/lib/api'
import { useCachedJson } from '@/lib/client-cache'
import type { HomeData, MemberRequestDto } from '@/lib/types'
import { ScreenHeader, formatINR, Loading } from './common'
import PaymentFlow from './PaymentFlow'
import StatusCard from './StatusCard'
import MemberIdCard from './MemberIdCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type Step = 'status' | 'form' | 'pay'

const PHOTO_MAX_MB = 5
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function prettySize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

export default function MemberJoinScreen() {
  const { user, setView, setUser } = useApp()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [existing, setExisting] = useState<MemberRequestDto | null | undefined>(undefined) // undefined = loading
  const [step, setStep] = useState<Step>('form')
  const [fee, setFee] = useState(1500)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', phone: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/member-request')
      if (res.status === 401) {
        // stale session — clear it so the auth screen actually shows
        clearToken()
        setUser(null)
        setView('auth')
        return
      }
      const data = await res.json()
      setExisting(data.request || null)
      setStep(data.request ? 'status' : 'form')
    } catch {
      setExisting(null)
    }
  }, [setView])

  useEffect(() => {
    if (!user) return
    loadStatus()
    setForm((f) => ({ ...f, name: f.name || user.name }))
  }, [user, loadStatus])

  // membership fee comes from the shared cached home payload (instant on repeat visits)
  const { data: home } = useCachedJson<HomeData>('/api/public/home')
  useEffect(() => {
    const f = Number(home?.settings?.memberFee)
    if (f) setFee(f)
  }, [home])

  // release the photo blob URL when leaving the screen
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [])

  if (!user) return <Loading />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!PHOTO_TYPES.includes(f.type)) {
      toast({ title: 'Photo must be JPG, PNG or WebP', variant: 'destructive' })
      return
    }
    if (f.size > PHOTO_MAX_MB * 1024 * 1024) {
      toast({ title: `Photo is too large — maximum ${PHOTO_MAX_MB} MB allowed`, variant: 'destructive' })
      return
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(null)
    setPhotoPreview(null)
  }

  const startPayment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.address.trim()) {
      toast({ title: 'Please fill all fields', variant: 'destructive' })
      return
    }
    if (!/^\d{10}$/.test(form.phone.trim())) {
      toast({ title: 'Please enter a valid 10-digit phone number', variant: 'destructive' })
      return
    }
    if (!photo) {
      toast({ title: 'Please upload your photo — it will be printed on your ID card', variant: 'destructive' })
      return
    }
    setStep('pay')
  }

  const submitUtr = async (utr: string): Promise<{ ok: boolean; error?: string }> => {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('name', form.name)
      fd.set('address', form.address)
      fd.set('phone', form.phone)
      fd.set('utr', utr)
      if (photo) fd.set('photo', photo)
      const res = await apiFetch('/api/member-request', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      await loadStatus()
      toast({ title: 'Application submitted successfully! 🎉' })
      return { ok: true }
    } catch {
      return { ok: false, error: 'Something went wrong' }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-club flex min-h-dvh flex-col">
      <ScreenHeader title="Member Join" subtitle="Dekchin Gobindapur B.A.S Sangha" onBack={() => setView('home')} accent="blue" />

      <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-5">
        {existing === undefined ? (
          <Loading />
        ) : step === 'status' && existing ? (
          existing.status === 'APPROVED' ? (
            /* ---------- APPROVED — congratulations + digital ID card ---------- */
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 via-white to-white p-6 text-center shadow-lg">
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-500" />
                <motion.span
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 shadow-inner"
                >
                  <PartyPopper className="h-8 w-8 text-emerald-600" />
                </motion.span>
                <h2 className="mt-3 text-2xl font-black text-emerald-900">অভিনন্দন, {existing.name}! 🎉</h2>
                <p className="mx-auto mt-1.5 max-w-sm text-sm font-medium leading-relaxed text-emerald-700">
                  আপনার membership approve হয়েছে — এখন আপনি B.A.S Sangha-র গর্বিত সদস্য।
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600">
                  <IdCard className="h-3.5 w-3.5" /> আপনার ডিজিটাল ID card নিচে — download করে রেখে দিন
                </p>
              </div>

              <MemberIdCard
                name={existing.name}
                phone={existing.phone}
                address={existing.address}
                photoUrl={existing.photoUrl || ''}
                cardNumber={existing.cardNumber || ''}
              />

              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-500">Fee Paid</span>
                  <span className="font-black text-stone-800">{formatINR(existing.fee)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-500">UTR Number</span>
                  <span className="font-mono font-bold text-stone-800">{existing.utr}</span>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ---------- WAITING / REJECTED ---------- */
            <StatusCard
              status={existing.status}
              title="Membership"
              waitingLabel="Under Verification"
              approvedLabel="Member ID — welcome to the Sangha family!"
              details={[
                { label: 'Name', value: existing.name },
                { label: 'Village', value: existing.address },
                { label: 'Phone', value: existing.phone },
                { label: 'Fee Paid', value: formatINR(existing.fee) },
                { label: 'UTR Number', value: existing.utr },
              ]}
              note={existing.note}
              onReapply={existing.status === 'REJECTED' ? () => setStep('form') : undefined}
            />
          )
        ) : step === 'pay' ? (
          <PaymentFlow
            title="Member Joining Fee"
            amount={fee}
            note="BAS Member Joining Fee"
            onSubmitUtr={submitUtr}
            onExpiredRefill={() => setStep('form')}
          />
        ) : (
          /* ---------- FORM ---------- */
          <form onSubmit={startPayment} className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm">
              <span className="rounded-full bg-amber-100 p-2.5">
                <IdCard className="h-6 w-6 text-amber-700" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-black text-stone-900">Annual Membership 2025</p>
                <p className="text-xs text-stone-500">Join our Sangha family & get your official ID card</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Joining Fee</p>
                <p className="flex items-center text-xl font-black text-emerald-700">
                  <BadgeIndianRupee className="h-4 w-4" /> {formatINR(fee)}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-stone-200/70 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-stone-500">
                  <Lock className="h-2.5 w-2.5" /> Fixed
                </p>
              </div>
            </div>

            <div className="space-y-3.5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-1.5 text-sm font-black text-stone-800">
                <UserPlus className="h-4 w-4 text-blue-800" /> Member Details
              </h3>
              <div className="space-y-1.5">
                <Label>Member Name *</Label>
                <Input value={form.name} onChange={set('name')} placeholder="Your full name" />
              </div>
              <div className="space-y-1.5">
                <Label>গ্রামের নাম / Village Name *</Label>
                <Input value={form.address} onChange={set('address')} placeholder="আপনার গ্রামের নাম লিখুন" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    value={form.phone}
                    onChange={set('phone')}
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit number"
                    className="pl-9"
                  />
                </div>
              </div>

              {/* photo upload */}
              <div className="space-y-1.5">
                <Label>Your Photo * <span className="font-normal text-stone-400">(ID card-এ ছাপা হবে • max {PHOTO_MAX_MB} MB)</span></Label>
                {photoPreview && photo ? (
                  <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-3">
                    <img src={photoPreview} alt="Selected member photo preview" className="h-20 w-20 rounded-xl object-cover ring-2 ring-emerald-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-stone-800">{photo.name}</p>
                      <p className="text-[11px] font-semibold text-emerald-600">{prettySize(photo.size)} • ready ✓</p>
                      <div className="mt-1.5 flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="h-7 rounded-full px-3 text-[11px]">
                          Change
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={clearPhoto} className="h-7 rounded-full px-3 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700">
                          <X className="mr-0.5 h-3 w-3" /> Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50/40"
                  >
                    <span className="rounded-full bg-blue-100 p-2.5">
                      <ImagePlus className="h-5 w-5 text-blue-800" />
                    </span>
                    <span className="text-sm font-bold text-stone-700">Tap to upload photo</span>
                    <span className="text-[11px] font-medium text-stone-400">JPG / PNG / WebP • maximum {PHOTO_MAX_MB} MB</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pickPhoto} aria-label="Upload member photo" />
              </div>
            </div>

            <Button type="submit" className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-5 text-base font-bold text-white shadow-lg hover:from-emerald-700 hover:to-emerald-600">
              Continue to Payment — {formatINR(fee)}
            </Button>
            <p className="text-center text-[11px] text-stone-400">Next step: UPI app দিয়ে {formatINR(fee)} payment করে UTR number submit করুন</p>
          </form>
        )}
      </main>
    </div>
  )
}
