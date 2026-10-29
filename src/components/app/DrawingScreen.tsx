'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { CalendarDays, FileUp, MapPin, Palette, PartyPopper, Send, X } from 'lucide-react'
import { useApp } from '@/lib/store'
import { apiFetch, clearToken } from '@/lib/api'
import type { DrawingRequestDto, EventDto } from '@/lib/types'
import { ScreenHeader, Watermark, Loading, formatINR } from './common'
import StatusCard from './StatusCard'
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
  const [form, setForm] = useState({ name: '', fatherName: '', className: '', schoolName: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/drawing-request')
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
        const ev: EventDto | undefined = d.events?.find((e: EventDto) => e.type === 'DRAWING')
        setEvent(ev || null)
      })
      .catch(() => {})
  }, [user, loadStatus])

  if (!user) return <Loading />

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.fatherName.trim() || !form.className.trim() || !form.schoolName.trim()) {
      toast({ title: 'Please fill all fields', variant: 'destructive' })
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
      fd.set('doc', file)
      const res = await apiFetch('/api/drawing-request', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      await loadStatus()
      setStep('done')
      toast({ title: 'Entry submitted successfully! 🎨' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Submission failed', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
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
          <StatusCard
            status={existing.status}
            title="Drawing Competition"
            approvedLabel="Entry Confirmed — bring your colours on the event day!"
            details={[
              { label: 'Name', value: existing.name },
              { label: "Father's Name", value: existing.fatherName },
              { label: 'Class', value: existing.className },
              { label: 'School', value: existing.schoolName },
              ...(event?.eventDate ? [{ label: 'Date', value: event.eventDate }] : []),
              ...(event?.venue ? [{ label: 'Venue', value: event.venue }] : []),
            ]}
            note={existing.note}
          />
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
                <span className={`rounded-full px-3 py-1 shadow-sm ${event.fee > 0 ? 'bg-amber-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                  {event.fee > 0 ? `Entry Fee ${formatINR(event.fee)}` : 'Free Entry'}
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

            <Button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-5 text-base font-bold text-white shadow-lg hover:from-amber-700 hover:to-amber-600">
              <Send className="mr-1.5 h-5 w-5" /> {submitting ? 'Submitting...' : 'Submit Entry'}
            </Button>
          </form>
        )}
      </main>
    </div>
  )
}
