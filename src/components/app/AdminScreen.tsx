'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Activity,
  Bell,
  BellRing,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Droplet,
  FileBarChart,
  HandCoins,
  ImagePlus,
  ImageUp,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  LogOut,
  Palette,
  Pencil,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Users,
  Volleyball,
  Wallet,
  Eye,
  EyeOff,
  X,
} from 'lucide-react'
import { useApp } from '@/lib/store'
import { apiFetch, clearToken } from '@/lib/api'
import { downloadNodeAsPdf } from '@/lib/pdf-report'
import type { BannerDto, MemberDto, EventDto, GalleryPhotoDto, DrawingRequestDto, QuickActionDto, NoticeDto, PujoHighlightDto } from '@/lib/types'
import type { SummaryService } from '@/app/api/admin/report/summary/route'
import { Loading, formatINR } from './common'
import { parseFormFields } from './event-form'
import { extraDataRows } from '@/lib/extra-data'
import DonationReceipt, { type DonationReceiptData } from './DonationReceipt'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { QA_ICONS, QA_ICON_KEYS, QA_COLORS, QA_COLOR_KEYS, QA_LINKS } from '@/lib/qa-options'

type Tab =
  | 'overview'
  | 'member'
  | 'tournament'
  | 'drawing'
  | 'blood'
  | 'donations'
  | 'reports'
  | 'banners'
  | 'committee'
  | 'events'
  | 'quick'
  | 'notices'
  | 'pujo'
  | 'gallery'
  | 'settings'
  | 'push'

type ReqStatus = 'WAITING' | 'APPROVED' | 'REJECTED'

/* ---------------- shared small pieces ---------------- */

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    WAITING: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
    UNPAID: 'bg-stone-200 text-stone-600',
  }
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${map[status]}`}>{status}</span>
}

function ImageUpload({ value, onChange, label }: { value?: string; onChange: (url: string) => void; label: string }) {
  const { toast } = useToast()
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('file', f)
      const res = await apiFetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onChange(data.url)
      toast({ title: 'Image uploaded' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed', variant: 'destructive' })
    } finally {
      setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center gap-3">
        {value ? (
           
          <img src={value} alt="preview" className="h-14 w-14 rounded-lg border border-stone-200 object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-dashed border-stone-300 text-stone-300">
            <ImagePlus className="h-6 w-6" />
          </span>
        )}
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> {busy ? 'Uploading...' : 'Upload'}
        </Button>
        <input ref={ref} type="file" accept="image/*,.pdf" onChange={upload} className="hidden" aria-label={label} />
      </div>
    </div>
  )
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input {...props} className="h-9 text-sm" />
    </div>
  )
}

/**
 * Date-range picker + CSV report download — shared by Donations & Requests tabs.
 * When `range`/`onRange` are provided the picker is controlled, so the SAME
 * dates also filter the visible list (date-wise view) in the parent tab.
 */
function ReportsBar({
  type,
  label,
  range,
  onRange,
}: {
  type: string
  label: string
  range?: { from: string; to: string }
  onRange?: (r: { from: string; to: string }) => void
}) {
  const { toast } = useToast()
  const [localFrom, setLocalFrom] = useState('')
  const [localTo, setLocalTo] = useState('')
  const from = range ? range.from : localFrom
  const to = range ? range.to : localTo
  const setFrom = (v: string) => (range ? onRange?.({ ...range, from: v }) : setLocalFrom(v))
  const setTo = (v: string) => (range ? onRange?.({ ...range, to: v }) : setLocalTo(v))
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const params = new URLSearchParams({ type })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await apiFetch(`/api/admin/report?${params.toString()}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Report failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `BAS-${label}-${from || 'all'}_${to || 'time'}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Report download হয়েছে ✓' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Report failed', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="space-y-1">
        <Label className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">From date</Label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36 bg-white text-xs" />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">To date</Label>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36 bg-white text-xs" />
      </div>
      <Button size="sm" disabled={busy} onClick={download} className="h-9 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
        <Download className="mr-1 h-4 w-4" /> {busy ? 'রেডি হচ্ছে...' : 'Report Download (CSV)'}
      </Button>
      <p className="w-full text-[10px] leading-relaxed text-emerald-800/70">
        📅 Date দিলে নিচের লিস্টেও শুধু ওই দিনগুলোর entry দেখা যাবে এবং রিপোর্টও ওই date-এরই নামবে — ফাঁকা রাখলে সব দেখা যাবে।
      </p>
    </div>
  )
}

/* ---------------- request card ---------------- */

interface GenericReq {
  id: string
  status: string // WAITING | APPROVED | REJECTED | UNPAID (drawing)
  paymentMethod?: string | null // QR (UPI online) | CASH
  note?: string | null
  createdAt: string
  user?: { name?: string; email?: string } | null
  [k: string]: unknown
}

/** true when the record was paid in cash (no UTR — admin confirms by hand) */
const isCashReq = (r: GenericReq) => String(r.paymentMethod || '').toUpperCase() === 'CASH'

function RequestCard({
  req,
  rows,
  tab,
  onChanged,
  onDelete,
}: {
  req: GenericReq
  rows: { label: string; value: string }[]
  tab: string
  onChanged: () => void
  onDelete?: (id: string) => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const decide = async (status: ReqStatus, withNote?: string) => {
    setBusy(true)
    try {
      const res = await apiFetch('/api/admin/requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, id: req.id, status, note: withNote ?? req.note ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (status === 'APPROVED') {
        if (data?.committeeSync === 'added')
          toast({
            title: 'Approved ✓ — কমিটি তালিকায় যোগ হয়েছে',
            description: 'নাম, ফোন ও ছবি committee list-এ auto যোগ হয়েছে',
          })
        else if (data?.committeeSync === 'duplicate')
          toast({
            title: 'Approved ✓ — committee-তে already আছে',
            description: 'একই নাম বা ফোন number আগে থাকায় duplicate যোগ হয়নি',
          })
        else toast({ title: 'Approved ✓' })
      } else {
        toast({ title: 'Rejected' })
      }
      onChanged()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-stone-900">{rows[0]?.value}</p>
          <p className="text-[11px] text-stone-400">
            by {req.user?.name || 'Unknown'} ({req.user?.email || '-'}) • {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isCashReq(req) && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800" title="Cash payment — admin confirms by hand">
              <Wallet className="h-3 w-3" /> CASH
            </span>
          )}
          <StatusChip status={req.status} />
          {onDelete && (
            <Button size="icon" variant="ghost" disabled={busy} onClick={() => onDelete(req.id)} aria-label="Delete this request" className="h-7 w-7 rounded-full text-red-500 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <button onClick={() => setOpen((o) => !o)} className="mt-2 flex w-full items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100">
        View full details <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-2 space-y-1 overflow-hidden rounded-lg bg-stone-50 p-3">
          {tab === 'member' && typeof req.photoUrl === 'string' && req.photoUrl && (
            <div className="flex items-center gap-2.5 pb-1.5">
              <a href={req.photoUrl} target="_blank" rel="noreferrer" className="shrink-0" aria-label="View member photo full size">
                <img src={req.photoUrl} alt="Member submitted photo" className="h-14 w-14 rounded-lg object-cover ring-1 ring-stone-200" />
              </a>
              <p className="text-[11px] font-semibold text-stone-500">Member photo — tap to view full size</p>
            </div>
          )}
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-3 text-xs">
              <span className="shrink-0 text-stone-500">{r.label}</span>
              <span className="break-all text-right font-semibold text-stone-800">{r.value}</span>
            </div>
          ))}
          {'docUrl' in req && typeof req.docUrl === 'string' && req.docUrl && (
            <a href={req.docUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-bold text-blue-700 underline">
              View uploaded document →
            </a>
          )}
          {req.status === 'WAITING' && (
            <div className="mt-2 space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Note for the applicant (optional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reject করলে user এই note টি দেখবে..."
                className="h-8 bg-white text-xs"
                maxLength={200}
              />
            </div>
          )}
        </motion.div>
      )}

      {req.status !== 'APPROVED' && (
        <div className="mt-3 flex gap-2">
          {/* UNPAID entries still need payment — approving them is not allowed */}
          {req.status === 'WAITING' && (
            <Button disabled={busy} onClick={() => decide('APPROVED')} className="h-9 flex-1 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700">
              <Check className="mr-1 h-4 w-4" /> {isCashReq(req) ? 'Cash পেয়েছি — Approve' : 'Approve'}
            </Button>
          )}
          {req.status !== 'REJECTED' && (
            <Button
              disabled={busy}
              onClick={() => decide('REJECTED', note.trim() ? note : undefined)}
              variant="outline"
              className="h-9 flex-1 rounded-lg border-red-200 text-xs font-bold text-red-600 hover:bg-red-50"
            >
              <X className="mr-1 h-4 w-4" /> Reject
            </Button>
          )}
        </div>
      )}
      {req.status === 'WAITING' && isCashReq(req) && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold text-amber-800">
          💵 এই entry-টি Cash (নগদ) — টাকা হাতে পেয়ে Approve চাপুন। UTR থাকবে না।
        </p>
      )}
      {req.status === 'APPROVED' && (
        <Button disabled={busy} onClick={() => decide('WAITING')} variant="outline" className="mt-3 h-9 w-full rounded-lg text-xs font-bold text-stone-600">
          Move back to Waiting
        </Button>
      )}
      {req.status === 'REJECTED' && note === '' && req.note && (
        <p className="mt-2 text-[11px] text-red-500">Note: {req.note}</p>
      )}
    </div>
  )
}

/* ---------------- main admin screen ---------------- */

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'donations', label: 'Donations', icon: HandCoins },
  { key: 'member', label: 'Member Requests', icon: ClipboardList },
  { key: 'tournament', label: 'Tournaments', icon: Trophy },
  { key: 'drawing', label: 'Drawing Entries', icon: Palette },
  { key: 'blood', label: 'Blood Donors', icon: Droplet },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
  { key: 'banners', label: 'Banners', icon: ImageUp },
  { key: 'committee', label: 'Committee', icon: Users },
  { key: 'events', label: 'Events', icon: CalendarDays },
  { key: 'quick', label: 'Quick Actions', icon: LayoutGrid },
  { key: 'notices', label: 'Notices', icon: Bell },
  { key: 'pujo', label: 'Pujo Info', icon: Sparkles },
  { key: 'gallery', label: 'Gallery', icon: Camera },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
  { key: 'push', label: 'Push Send', icon: BellRing },
]

export default function AdminScreen() {
  const { user, setView, setUser } = useApp()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('overview')

  const logout = async () => {
    clearToken()
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // server unreachable — still log out locally; token is already cleared
    } finally {
      setUser(null)
      setView('welcome')
    }
  }

  if (!user || user.role !== 'ADMIN')
    return (
      <div className="devotional-bg flex min-h-dvh flex-col items-center justify-center gap-3 text-white">
        <ShieldCheck className="h-10 w-10 text-amber-400" />
        <p className="font-bold">Admin access only</p>
        <Button onClick={() => setView('auth')} variant="secondary" className="rounded-full">Go to Login</Button>
      </div>
    )

  return (
    <div className="min-h-dvh bg-stone-100">
      {/* header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 overflow-hidden rounded-full bg-white ring-2 ring-amber-400">
              <Image src="/logo.png" alt="logo" width={36} height={36} className="h-full w-full object-contain p-0.5" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Admin Panel</p>
              <p className="text-[10px] text-amber-300/80">B.A.S Sangha • full control</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setView('home')} className="rounded-full text-white hover:bg-white/15">
              <Activity className="mr-1 h-4 w-4" /> Site
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Logout" className="rounded-full text-white hover:bg-white/15">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {/* tabs */}
        <div className="no-scrollbar mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  active ? 'bg-amber-400 text-stone-900 shadow' : 'bg-white/10 text-white/75 hover:bg-white/20'
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            )
          })}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'donations' && <DonationsTab />}
        {tab === 'member' && <RequestsTab tab="member" title="Member Join Requests" />}
        {tab === 'tournament' && <RequestsTab tab="tournament" title="Tournament Registrations" />}
        {tab === 'drawing' && <RequestsTab tab="drawing" title="Drawing Competition Entries" />}
        {tab === 'blood' && <RequestsTab tab="blood" title="Blood Donation Pledges" />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'banners' && <BannersTab />}
        {tab === 'committee' && <CommitteeTab />}
        {tab === 'events' && <EventsTab />}
        {tab === 'quick' && <QuickActionsTab />}
        {tab === 'notices' && <NoticesTab />}
        {tab === 'pujo' && <PujoInfoTab />}
        {tab === 'gallery' && <GalleryTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'push' && <PushTab />}
      </main>
    </div>
  )
}

/* ---------------- overview ---------------- */

interface OverviewData {
  member: { waiting: number; approved: number; rejected: number }
  tournament: { waiting: number; approved: number; rejected: number }
  drawing: { waiting: number; approved: number; rejected: number }
  blood: { waiting: number; approved: number; rejected: number }
  donation: { pending: number; submitted: number; verified: number; rejected: number; totalAmount: number }
  users: number
  committee: number
  banners: number
  photos: number
}

function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    apiFetch('/api/admin/overview')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load')
        return r.json()
      })
      .then(setData)
      .catch(() => setFailed(true))
  }, [])
  if (failed)
    return <p className="p-6 text-center text-sm font-semibold text-red-600">Overview load করা যায়নি — আবার লগইন করে চেষ্টা করুন।</p>
  if (!data) return <Loading />
  const donation = data.donation || { totalAmount: 0, pending: 0, submitted: 0, verified: 0, rejected: 0 }
  const sections = [
    { key: 'member', label: 'Member Join', icon: Users },
    { key: 'tournament', label: 'Tournaments', icon: Trophy },
    { key: 'drawing', label: 'Drawing', icon: Palette },
    { key: 'blood', label: 'Blood Donation', icon: Droplet },
  ] as const
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Registered Users', value: data.users },
          { label: 'Committee Members', value: data.committee },
          { label: 'Active Banners', value: data.banners },
          { label: 'Gallery Photos', value: data.photos },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-blue-900">{s.value}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-stone-500">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Donations summary (payment gateway) */}
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm sm:col-span-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-black text-stone-800">
              <span className="rounded-lg bg-amber-100 p-1.5"><HandCoins className="h-4 w-4 text-amber-700" /></span>
              Donations
            </p>
            <p className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-white">
              Verified total: {formatINR(donation.totalAmount || 0)}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-white py-2">
              <p className="text-lg font-black text-stone-600">{donation.pending}</p>
              <p className="text-[10px] font-bold text-stone-400">PENDING</p>
            </div>
            <div className="rounded-xl bg-white py-2">
              <p className="text-lg font-black text-amber-700">{donation.submitted}</p>
              <p className="text-[10px] font-bold text-amber-600">SUBMITTED</p>
            </div>
            <div className="rounded-xl bg-white py-2">
              <p className="text-lg font-black text-emerald-700">{donation.verified}</p>
              <p className="text-[10px] font-bold text-emerald-600">VERIFIED</p>
            </div>
            <div className="rounded-xl bg-white py-2">
              <p className="text-lg font-black text-red-700">{donation.rejected}</p>
              <p className="text-[10px] font-bold text-red-600">REJECTED</p>
            </div>
          </div>
        </div>
        {sections.map((sec) => {
          const Icon = sec.icon
          const d = data[sec.key] || { waiting: 0, approved: 0, rejected: 0 }
          return (
            <div key={sec.key} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black text-stone-800">
                <span className="rounded-lg bg-blue-50 p-1.5"><Icon className="h-4 w-4 text-blue-800" /></span> {sec.label}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-amber-50 py-2">
                  <p className="text-lg font-black text-amber-700">{d.waiting}</p>
                  <p className="text-[10px] font-bold text-amber-600">WAITING</p>
                </div>
                <div className="rounded-xl bg-emerald-50 py-2">
                  <p className="text-lg font-black text-emerald-700">{d.approved}</p>
                  <p className="text-[10px] font-bold text-emerald-600">APPROVED</p>
                </div>
                <div className="rounded-xl bg-red-50 py-2">
                  <p className="text-lg font-black text-red-700">{d.rejected}</p>
                  <p className="text-[10px] font-bold text-red-600">REJECTED</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- donations tab (payment gateway receipts) ---------------- */

interface DonationRow extends DonationReceiptData {
  user?: { name?: string; email?: string } | null
}

const isCashDonation = (d: DonationRow) => String(d.paymentMethod || '').toUpperCase() === 'CASH'

function DonationsTab() {
  const { toast } = useToast()
  const [items, setItems] = useState<DonationRow[] | null>(null)
  const [viewing, setViewing] = useState<DonationRow | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [range, setRange] = useState({ from: '', to: '' })

  const load = useCallback(() => {
    apiFetch('/api/admin/donations')
      .then((r) => r.json())
      .then((d) => setItems(d.donations || []))
      .catch(() => setItems([]))
  }, [])
  useEffect(load, [load])

  const decide = async (id: string, status: 'VERIFIED' | 'REJECTED', withNote?: string) => {
    setBusyId(id)
    try {
      const res = await apiFetch('/api/admin/donations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, note: withNote ?? undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: status === 'VERIFIED' ? 'Donation verified ✓' : 'Donation rejected' })
      setNoteFor(null)
      setNote('')
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('এই donation entry টি পুরোপুরি মুছে ফেলবেন?\n\nফেরানো যাবে না!')) return
    setBusyId(id)
    try {
      const res = await apiFetch(`/api/admin/donations?id=${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Entry মুছে ফেলা হয়েছে ✓' })
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Delete failed', variant: 'destructive' })
    } finally {
      setBusyId(null)
    }
  }

  if (!items) return <Loading />

  // date-wise view: the same from/to dates that drive the CSV report also filter the visible cards
  const filtered = items.filter((d) => {
    if (!range.from && !range.to) return true
    const dt = new Date(d.createdAt)
    if (range.from && dt < new Date(`${range.from}T00:00:00`)) return false
    if (range.to && dt > new Date(`${range.to}T23:59:59.999`)) return false
    return true
  })

  return (
    <div>
      <h2 className="mb-4 text-lg font-black text-stone-800">
        Donations{' '}
        <span className="ml-1 text-sm font-bold text-stone-400">
          ({filtered.length}{(range.from || range.to) && filtered.length !== items.length ? ` / ${items.length}` : ''})
        </span>
      </h2>
      <ReportsBar type="donations" label="Donations" range={range} onRange={setRange} />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-400">No donations yet</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-8 text-center text-sm font-semibold text-amber-700">
          এই date-এ কোনো donation নেই — উপরের date বদলে দেখুন
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((d) => (
            <div key={d.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-stone-900">
                    {formatINR(d.amount)} — {d.payerName}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    by {d.user?.name || 'Unknown'} ({d.user?.email || '-'}) •{' '}
                    {new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isCashDonation(d) && (
                    <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                      <Wallet className="h-3 w-3" /> CASH
                    </span>
                  )}
                  <DonStatusChip status={d.status} />
                </div>
              </div>
              <div className="mt-3 space-y-1 rounded-xl bg-stone-50 p-3 text-[11px]">
                <p className="flex justify-between gap-2"><span className="text-stone-400">Order ID</span><span className="font-mono font-bold text-stone-700">{d.orderId}</span></p>
                {isCashDonation(d) ? (
                  <p className="flex justify-between gap-2"><span className="text-stone-400">Payment</span><span className="font-bold text-amber-700">💵 Cash (নগদ) — admin verify</span></p>
                ) : (
                  <p className="flex justify-between gap-2"><span className="text-stone-400">UTR</span><span className="font-mono font-bold text-stone-700">{d.utr || '—'}</span></p>
                )}
                <p className="flex justify-between gap-2"><span className="text-stone-400">Phone</span><span className="font-bold text-stone-700">{d.payerPhone || '—'}</span></p>
                {d.note && <p className="flex justify-between gap-2"><span className="text-stone-400">Note</span><span className="text-right font-semibold text-stone-600">{d.note}</span></p>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {d.status !== 'VERIFIED' && (
                  <Button size="sm" disabled={busyId === d.id} onClick={() => decide(d.id, 'VERIFIED')} className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                    <Check className="mr-1 h-3.5 w-3.5" /> {isCashDonation(d) ? 'Cash পেয়েছি — Verify' : 'Verify'}
                  </Button>
                )}
                {d.status !== 'REJECTED' && (
                  <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => { setNoteFor(d.id); setNote('') }} className="rounded-lg border-red-200 text-red-600 hover:bg-red-50">
                    <X className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setViewing(d)} className="rounded-lg text-blue-700 hover:bg-blue-50">
                  Receipt
                </Button>
                <Button size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => remove(d.id)} aria-label="Delete this donation entry" className="rounded-lg text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {noteFor === d.id && (
                <div className="mt-3 space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reject reason (optional)" className="h-9 rounded-lg bg-white text-xs" />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busyId === d.id} onClick={() => decide(d.id, 'REJECTED', note)} className="rounded-lg bg-red-600 text-white hover:bg-red-700">Confirm Reject</Button>
                    <Button size="sm" variant="ghost" onClick={() => setNoteFor(null)} className="rounded-lg">Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* full receipt dialog */}
      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto max-w-sm rounded-3xl bg-white p-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-black text-stone-800">Donation Receipt — {viewing?.orderId}</DialogTitle>
          </DialogHeader>
          {viewing && <DonationReceipt donation={viewing} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DonStatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-stone-100 text-stone-600',
    SUBMITTED: 'bg-amber-100 text-amber-800',
    VERIFIED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
  }
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${map[status] || map.PENDING}`}>{status}</span>
}

/* ---------------- requests tab (generic) ---------------- */

function RequestsTab({ tab, title }: { tab: string; title: string }) {
  const { toast } = useToast()
  const [items, setItems] = useState<GenericReq[] | null>(null)
  const [range, setRange] = useState({ from: '', to: '' })

  const load = useCallback(() => {
    apiFetch(`/api/admin/requests?tab=${tab}`)
      .then((r) => r.json())
      .then((d) => setItems(d.requests || []))
      .catch(() => setItems([]))
  }, [tab])
  useEffect(load, [load])

  const removeOne = async (id: string) => {
    if (!confirm('এই request টি পুরোপুরি মুছে ফেলবেন?\n\nফেরানো যাবে না!')) return
    try {
      const res = await apiFetch(`/api/admin/requests?tab=${tab}&id=${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Request মুছে ফেলা হয়েছে ✓' })
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Delete failed', variant: 'destructive' })
    }
  }

  if (!items) return <Loading />

  // date-wise view: the same from/to dates that drive the CSV report also filter the visible cards
  const filtered = items.filter((r) => {
    if (!range.from && !range.to) return true
    const d = new Date(r.createdAt)
    if (range.from && d < new Date(`${range.from}T00:00:00`)) return false
    if (range.to && d > new Date(`${range.to}T23:59:59.999`)) return false
    return true
  })

  const rowsFor = (r: GenericReq): { label: string; value: string }[] => {
    // answers to the admin-defined extra form fields (tournament/drawing/blood)
    const extra = tab === 'member' ? [] : extraDataRows(typeof r.extraData === 'string' ? r.extraData : null)
    if (tab === 'member')
      return [
        { label: 'Name', value: String(r.name || '') },
        { label: 'Village', value: String(r.address || '') },
        { label: 'Phone', value: String(r.phone || '') },
        { label: 'Fee', value: formatINR(Number(r.fee || 0)) },
        ...(isCashReq(r)
          ? [{ label: 'Payment', value: '💵 Cash (নগদ)' }]
          : [
            { label: 'Payment', value: 'QR / UPI' },
            { label: 'UTR', value: String(r.utr || '') },
          ]),
        { label: 'Member ID', value: r.cardNumber ? String(r.cardNumber) : '— (auto on approve)' },
      ]
    if (tab === 'tournament')
      return [
        { label: 'Team Name', value: String(r.teamName || '') },
        { label: 'Type', value: String(r.type || '') },
        { label: 'Address', value: String(r.address || '') },
        { label: 'Phone', value: String(r.phone || '') },
        { label: 'Fee', value: formatINR(Number(r.fee || 0)) },
        ...(isCashReq(r)
          ? [{ label: 'Payment', value: '💵 Cash (নগদ)' }]
          : [
            { label: 'Payment', value: 'QR / UPI' },
            { label: 'UTR', value: String(r.utr || '') },
          ]),
        ...extra,
      ]
    if (tab === 'drawing')
      return [
        { label: 'Name', value: String(r.name || '') },
        { label: "Father's Name", value: String(r.fatherName || '') },
        { label: 'Class', value: String(r.className || '') },
        { label: 'School', value: String(r.schoolName || '') },
        { label: 'Mobile', value: String(r.phone || '') },
        { label: 'Fee', value: formatINR(Number(r.fee || 0)) },
        ...(isCashReq(r)
          ? [{ label: 'Payment', value: '💵 Cash (নগদ)' }]
          : [
            { label: 'Payment', value: 'QR / UPI' },
            { label: 'UTR', value: String(r.utr || '—') },
          ]),
        { label: 'Document', value: 'uploaded ✓' },
        ...extra,
      ]
    return [
      { label: 'Name', value: String(r.name || '') },
      { label: 'Address', value: String(r.address || '') },
      { label: 'Phone', value: String(r.phone || '') },
      ...extra,
    ]
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-black text-stone-800">
        {title}{' '}
        <span className="ml-1 text-sm font-bold text-stone-400">
          ({filtered.length}{(range.from || range.to) && filtered.length !== items.length ? ` / ${items.length}` : ''})
        </span>
      </h2>
      <ReportsBar type={tab} label={title.replace(/\s+/g, '-')} range={range} onRange={setRange} />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-400">No requests yet</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-8 text-center text-sm font-semibold text-amber-700">
          এই date-এ কোনো entry নেই — উপরের date বদলে দেখুন
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => (
            <RequestCard key={r.id} req={r} tab={tab} rows={rowsFor(r)} onChanged={load} onDelete={removeOne} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- reports tab (all-service cash/online money report + PDF) ---------------- */

interface ReportSummary {
  from: string
  to: string
  services: SummaryService[]
  grand: { cashTotal: number; onlineTotal: number; cashCount: number; onlineCount: number; count: number; total: number }
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function ReportsTab() {
  const { toast } = useToast()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const pdfRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (f) params.set('from', f)
      if (t) params.set('to', t)
      const res = await apiFetch(`/api/admin/report/summary?${params.toString()}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed')
      setData(d)
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Report failed', variant: 'destructive' })
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [toast])

  // initial load (all time)
  useEffect(() => {
    load('', '')
  }, [load])

  const downloadPdf = async () => {
    if (!pdfRef.current || pdfBusy) return
    setPdfBusy(true)
    try {
      await downloadNodeAsPdf(pdfRef.current, `BAS-Report-${from || 'all'}_${to || 'time'}.pdf`)
      toast({ title: 'PDF download হয়েছে ✓' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'PDF failed — আবার চেষ্টা করুন', variant: 'destructive' })
    } finally {
      setPdfBusy(false)
    }
  }

  const grand = data?.grand

  return (
    <div>
      <h2 className="mb-1 text-lg font-black text-stone-800">Reports — Cash & Online হিসেব</h2>
      <p className="mb-4 text-xs text-stone-500">
        সব service-এর approve হওয়া Cash ও QR/Online transaction — date by date, total ও category অনুযায়ী। PDF download করুন।
      </p>

      {/* date range + actions */}
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">From date</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36 bg-white text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">To date</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36 bg-white text-xs" />
        </div>
        <Button size="sm" disabled={loading} onClick={() => load(from, to)} className="h-9 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Load
        </Button>
        <Button size="sm" disabled={pdfBusy || !data} onClick={downloadPdf} className="h-9 rounded-lg bg-blue-900 text-white hover:bg-blue-800">
          {pdfBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
          {pdfBusy ? 'PDF তৈরি হচ্ছে...' : 'Report PDF Download'}
        </Button>
        <p className="w-full text-[10px] leading-relaxed text-emerald-800/70">
          📅 ফাঁকা রাখলে সব time-এর হিসেব আসবে। শুধু approve/verify হওয়া entry-গুলোই হিসেবে আসে — waiting/rejected আসে না।
        </p>
      </div>

      {loading && !data ? (
        <Loading />
      ) : !data || !grand ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-400">Report load করা যায়নি</p>
      ) : (
        <>
          {/* grand summary */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center shadow-sm">
              <p className="text-xl font-black text-amber-800">{formatINR(grand.cashTotal)}</p>
              <p className="mt-0.5 text-[11px] font-bold text-amber-700">💵 Cash মোট ({grand.cashCount})</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center shadow-sm">
              <p className="text-xl font-black text-emerald-800">{formatINR(grand.onlineTotal)}</p>
              <p className="mt-0.5 text-[11px] font-bold text-emerald-700">📱 Online মোট ({grand.onlineCount})</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center shadow-sm">
              <p className="text-xl font-black text-blue-900">{formatINR(grand.total)}</p>
              <p className="mt-0.5 text-[11px] font-bold text-blue-700">সব মিলিয়ে মোট</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm">
              <p className="text-xl font-black text-stone-800">{grand.count}</p>
              <p className="mt-0.5 text-[11px] font-bold text-stone-500">মোট entry</p>
            </div>
          </div>

          {/* per-service cards */}
          <div className="space-y-3">
            {data.services.map((s) => (
              <div key={s.key} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-stone-900">{s.label}</p>
                  {s.money ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black">
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">💵 Cash {formatINR(s.cashTotal)} ({s.cashCount})</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">📱 Online {formatINR(s.onlineTotal)} ({s.onlineCount})</span>
                      <span className="rounded-full bg-blue-900 px-2.5 py-1 text-white">মোট {formatINR(s.total)}</span>
                    </div>
                  ) : (
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black text-stone-600">{s.count} জন (ফি নেই)</span>
                  )}
                </div>

                {s.rows.length === 0 ? (
                  <p className="mt-3 rounded-xl bg-stone-50 p-3 text-center text-[11px] text-stone-400">এই date range-এ কোনো approve হওয়া entry নেই</p>
                ) : (
                  <div className="mt-3 max-h-96 overflow-y-auto rounded-xl border border-stone-100">
                    <table className="w-full text-left text-[11px]">
                      <thead className="sticky top-0 bg-stone-50 text-[9px] font-black uppercase tracking-wide text-stone-400">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Name / ID</th>
                          <th className="px-3 py-2">Method</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {s.rows.map((r) => (
                          <tr key={r.id} className="text-stone-700">
                            <td className="whitespace-nowrap px-3 py-1.5 font-semibold">{fmtDay(r.date)}</td>
                            <td className="max-w-[180px] truncate px-3 py-1.5">{r.name}</td>
                            <td className="px-3 py-1.5">
                              {s.money ? (
                                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${r.method === 'CASH' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {r.method === 'CASH' ? 'CASH' : 'ONLINE'}
                                </span>
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-1.5 text-right font-black">{s.money ? formatINR(r.amount) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* hidden A4 print node for the PDF (rendered off-screen) */}
      {data && (
        <div className="pointer-events-none fixed left-[-10000px] top-0" aria-hidden>
          <ReportPdfDoc ref={pdfRef} data={data} />
        </div>
      )}
    </div>
  )
}

/** A4-sized printable report — html-to-image + jsPDF দিয়ে এটাই PDF হয়ে যায়। */
function ReportPdfDoc({ data, ref }: { data: ReportSummary; ref: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="w-[794px] bg-white p-10 text-stone-900">
      {/* header */}
      <div className="flex items-center justify-between border-b-4 border-blue-900 pb-4">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="logo" className="h-16 w-16 rounded-full object-cover ring-2 ring-amber-400" />
          <div>
            <p className="text-2xl font-black tracking-wide text-blue-950">B.A.S SANGHA</p>
            <p className="text-xs font-bold text-stone-500">Dakshin Gobindapur • Estd 2021</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-blue-950">সমস্ত Service-এর আয়ের হিসেব</p>
          <p className="text-xs font-bold text-stone-500">
            {data.from || data.to ? `${data.from || 'শুরু'} → ${data.to || 'আজ পর্যন্ত'}` : 'সম্পূর্ণ রেকর্ড (All time)'}
          </p>
          <p className="mt-0.5 text-[10px] text-stone-400">শুধুমাত্র Approve/Verify হওয়া entry</p>
        </div>
      </div>

      {/* grand summary */}
      <div className="mt-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Cash মোট (নগদ)', value: formatINR(data.grand.cashTotal), sub: `${data.grand.cashCount} entry`, cls: 'border-amber-300 bg-amber-50' },
          { label: 'Online মোট (QR/UPI)', value: formatINR(data.grand.onlineTotal), sub: `${data.grand.onlineCount} entry`, cls: 'border-emerald-300 bg-emerald-50' },
          { label: 'সব মিলিয়ে মোট', value: formatINR(data.grand.total), sub: 'Cash + Online', cls: 'border-blue-300 bg-blue-50' },
          { label: 'মোট Entry', value: String(data.grand.count), sub: 'সব service মিলিয়ে', cls: 'border-stone-300 bg-stone-50' },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border-2 p-3 text-center ${c.cls}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{c.label}</p>
            <p className="mt-1 text-lg font-black text-stone-900">{c.value}</p>
            <p className="text-[10px] font-semibold text-stone-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* per-service sections */}
      {data.services.map((s) => (
        <div key={s.key} className="mt-6 break-inside-avoid">
          <div className="flex items-center justify-between border-b-2 border-stone-200 pb-1.5">
            <p className="text-sm font-black text-blue-950">{s.label}</p>
            {s.money ? (
              <p className="text-[11px] font-black text-stone-600">
                Cash: {formatINR(s.cashTotal)} ({s.cashCount}) &nbsp;•&nbsp; Online: {formatINR(s.onlineTotal)} ({s.onlineCount}) &nbsp;•&nbsp; মোট:{' '}
                <span className="text-blue-900">{formatINR(s.total)}</span>
              </p>
            ) : (
              <p className="text-[11px] font-black text-stone-600">{s.count} জন (ফি নেই)</p>
            )}
          </div>
          {s.rows.length > 0 ? (
            <table className="mt-2 w-full text-left text-[11px]">
              <thead className="bg-stone-100 text-[9px] font-black uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Date</th>
                  <th className="px-2 py-1.5">Name / ID</th>
                  <th className="px-2 py-1.5">Method</th>
                  <th className="px-2 py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {s.rows.map((r, i) => (
                  <tr key={r.id} className="text-stone-700">
                    <td className="px-2 py-1 text-stone-400">{i + 1}</td>
                    <td className="whitespace-nowrap px-2 py-1 font-semibold">{fmtDay(r.date)}</td>
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1 font-bold">{s.money ? (r.method === 'CASH' ? 'CASH' : 'ONLINE') : '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-right font-black">{s.money ? formatINR(r.amount) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-[11px] font-semibold text-stone-400">এই সময়ে কোনো approve হওয়া entry নেই।</p>
          )}
        </div>
      ))}

      <p className="mt-8 border-t border-dashed border-stone-300 pt-3 text-center text-[10px] text-stone-400">
        B.A.S Sangha • Dakshin Gobindapur — computer generated report • {new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}

/* ---------------- banners ---------------- */

function BannersTab() {
  const { toast } = useToast()
  const [banners, setBanners] = useState<BannerDto[] | null>(null)
  const [editing, setEditing] = useState<Partial<BannerDto> | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiFetch('/api/admin/banners').then((r) => r.json()).then((d) => setBanners(d.banners || [])).catch(() => setBanners([]))
  }, [])
  useEffect(load, [load])

  const save = async () => {
    if (!editing) return
    if (!editing.title || !editing.imageUrl) {
      toast({ title: 'Title and image are required', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const method = editing.id ? 'PUT' : 'POST'
      const res = await apiFetch('/api/admin/banners', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Banner saved ✓' })
      setEditing(null)
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this banner permanently?')) return
    const res = await apiFetch(`/api/admin/banners?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast({ title: 'Delete failed — session expired?', variant: 'destructive' }); return }
    toast({ title: 'Banner deleted' })
    load()
  }

  if (!banners) return <Loading />
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black text-stone-800">Hero Banners</h2>
        <Button size="sm" onClick={() => setEditing({ title: '', imageUrl: '', subtitle: '', badge: '', objectFit: 'cover', sortOrder: banners.length + 1, active: true })} className="rounded-full bg-blue-900 text-white hover:bg-blue-800">
          <ImagePlus className="mr-1 h-4 w-4" /> Add Banner
        </Button>
      </div>

      {editing && (
        <div className="mb-4 space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
          <Field label="Title *" value={editing.title || ''} onChange={(e) => setEditing((b) => ({ ...b, title: e.target.value }))} placeholder="e.g. Cricket Tournament 2025" />
          <Field label="Subtitle" value={editing.subtitle || ''} onChange={(e) => setEditing((b) => ({ ...b, subtitle: e.target.value }))} placeholder="Small line below title" />
          <Field label="Badge (ছোট পিল লেখা)" value={editing.badge || ''} onChange={(e) => setEditing((b) => ({ ...b, badge: e.target.value }))} placeholder="e.g. খেলার স্মৃতি" />
          <ImageUpload label="Banner Image *" value={editing.imageUrl} onChange={(url) => setEditing((b) => ({ ...b, imageUrl: url }))} />
          <div className="space-y-1">
            <Label className="text-xs">Image Fit</Label>
            <div className="flex gap-2">
              {([['cover', 'Fill card'], ['contain', 'Full artwork, blurred sides']] as const).map(([v, lbl]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEditing((b) => ({ ...b, objectFit: v }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                    (editing.objectFit || 'cover') === v ? 'border-blue-900 bg-blue-900 text-white' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-400">cover = image fills the card &bull; contain = full artwork with blurred sides</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-28"><Field label="Sort Order" type="number" value={String(editing.sortOrder ?? 0)} onChange={(e) => setEditing((b) => ({ ...b, sortOrder: Number(e.target.value) }))} /></div>
            <div className="mt-4 flex items-center gap-2">
              <Switch checked={editing.active !== false} onCheckedChange={(v) => setEditing((b) => ({ ...b, active: v }))} id="banner-active" />
              <Label htmlFor="banner-active" className="text-xs">Active</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={save} className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Save className="mr-1 h-4 w-4" /> Save</Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="rounded-lg">Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {banners.map((b) => (
          <div key={b.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="relative h-28 w-full">
              { }
              <img src={b.imageUrl} alt={b.title} className="h-full w-full object-cover" />
              {!b.active && <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">INACTIVE</span>}
            </div>
            <div className="flex items-center justify-between p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-800">{b.title}</p>
                <p className="truncate text-[11px] text-stone-400">{b.badge ? `${b.badge} • ` : ''}{b.subtitle || '-'} • #{b.sortOrder}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(b)} aria-label="Edit" className="h-8 w-8 text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(b.id)} aria-label="Delete" className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- committee ---------------- */

function CommitteeTab() {
  const { toast } = useToast()
  const [members, setMembers] = useState<MemberDto[] | null>(null)
  const [editing, setEditing] = useState<Partial<MemberDto> | null>(null)
  const [busy, setBusy] = useState(false)
  const [hidePhones, setHidePhones] = useState(false)
  const [phoneBusy, setPhoneBusy] = useState(false)

  const load = useCallback(() => {
    apiFetch('/api/admin/members').then((r) => r.json()).then((d) => setMembers(d.members || [])).catch(() => setMembers([]))
  }, [])
  useEffect(load, [load])

  useEffect(() => {
    apiFetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => setHidePhones(d.settings?.hideCommitteePhone === '1'))
      .catch(() => {})
  }, [])

  const togglePhones = async (v: boolean) => {
    setPhoneBusy(true)
    const prev = hidePhones
    setHidePhones(v)
    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { hideCommitteePhone: v ? '1' : '0' } }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: v ? 'ফোন নম্বর লুকিয়ে দেওয়া হয়েছে ✓' : 'ফোন নম্বর দেখা যাবে ✓' })
    } catch (err) {
      setHidePhones(prev)
      toast({ title: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' })
    } finally {
      setPhoneBusy(false)
    }
  }

  const save = async () => {
    if (!editing) return
    if (!editing.name || !editing.phone || !editing.photoUrl) {
      toast({ title: 'Name, phone and photo are required', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const method = editing.id ? 'PUT' : 'POST'
      const res = await apiFetch('/api/admin/members', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Member saved ✓' })
      setEditing(null)
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Remove this committee member permanently?')) return
    const res = await apiFetch(`/api/admin/members?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast({ title: 'Delete failed — session expired?', variant: 'destructive' }); return }
    toast({ title: 'Member removed' })
    load()
  }

  // per-member phone visibility toggle (each member has its own switch)
  const togglePhoneVisible = async (m: MemberDto) => {
    const next = m.phoneVisible === false
    // optimistic update
    setMembers((prev) => (prev ? prev.map((x) => (x.id === m.id ? { ...x, phoneVisible: next } : x)) : prev))
    try {
      const res = await apiFetch('/api/admin/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, phoneVisible: next }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: next ? `${m.name} — ফোন নম্বর দেখা যাবে ✓` : `${m.name} — ফোন নম্বর লুকানো হলো ✓` })
    } catch (err) {
      // rollback on failure
      setMembers((prev) => (prev ? prev.map((x) => (x.id === m.id ? { ...x, phoneVisible: !next } : x)) : prev))
      toast({ title: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' })
    }
  }

  if (!members) return <Loading />
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black text-stone-800">Pujo Committee Members</h2>
        <Button size="sm" onClick={() => setEditing({ name: '', role: 'Member', phone: '', photoUrl: '', sortOrder: members.length + 1, active: true })} className="rounded-full bg-blue-900 text-white hover:bg-blue-800">
          <Users className="mr-1 h-4 w-4" /> Add Member
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-stone-800">📞 সব ফোন নম্বর একসাথে hide / unhide</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-stone-500">
            চালু করলে user-রা কারো ফোন নম্বর দেখতে পাবে না। শুধু একজনের লুকাতে বা দেখাতে চাইলে নিচে তার কার্ডের 👁 বাটন ব্যবহার করুন — প্রত্যেক সদস্যের জন্য আলাদা।
          </p>
        </div>
        <Switch disabled={phoneBusy} checked={hidePhones} onCheckedChange={togglePhones} id="hide-phones" />
      </div>

      {editing && (
        <div className="mb-4 space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
          <Field label="Name *" value={editing.name || ''} onChange={(e) => setEditing((m) => ({ ...m, name: e.target.value }))} placeholder="Full name" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Designation" value={editing.role || ''} onChange={(e) => setEditing((m) => ({ ...m, role: e.target.value }))} placeholder="e.g. President" />
            <Field label="Phone *" value={editing.phone || ''} onChange={(e) => setEditing((m) => ({ ...m, phone: e.target.value }))} placeholder="10-digit" />
          </div>
          <ImageUpload label="Photo *" value={editing.photoUrl} onChange={(url) => setEditing((m) => ({ ...m, photoUrl: url }))} />
          <div className="flex items-center gap-4">
            <div className="w-28"><Field label="Sort Order" type="number" value={String(editing.sortOrder ?? 0)} onChange={(e) => setEditing((m) => ({ ...m, sortOrder: Number(e.target.value) }))} /></div>
            <div className="mt-4 flex items-center gap-2">
              <Switch checked={editing.active !== false} onCheckedChange={(v) => setEditing((m) => ({ ...m, active: v }))} id="mem-active" />
              <Label htmlFor="mem-active" className="text-xs">Active</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={save} className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Save className="mr-1 h-4 w-4" /> Save</Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="rounded-lg">Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            { }
            <img src={m.photoUrl} alt={m.name} className="h-14 w-14 rounded-full border-2 border-amber-300 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-stone-800">{m.name}</p>
              <p className="truncate text-[11px] text-stone-400">
                {m.role} • {m.phone}
                {m.phoneVisible === false && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">লুকানো</span>
                )}
              </p>
              {!m.active && <p className="text-[10px] font-bold text-red-500">INACTIVE</p>}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button size="icon" variant="ghost" onClick={() => togglePhoneVisible(m)} aria-label={m.phoneVisible === false ? 'Show phone number' : 'Hide phone number'} title={m.phoneVisible === false ? 'ফোন নম্বর দেখান' : 'ফোন নম্বর লুকান'} className="h-8 w-8 text-amber-700 hover:bg-amber-50">
                {m.phoneVisible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditing(m)} aria-label="Edit" className="h-8 w-8 text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(m.id)} aria-label="Delete" className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- events ---------------- */

function EventsTab() {
  const { toast } = useToast()
  const [events, setEvents] = useState<EventDto[] | null>(null)

  const load = useCallback(() => {
    apiFetch('/api/admin/events').then((r) => r.json()).then((d) => setEvents(d.events || [])).catch(() => setEvents([]))
  }, [])
  useEffect(load, [load])

  const save = async (ev: EventDto) => {
    try {
      const res = await apiFetch('/api/admin/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ev),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `${ev.title} saved ✓` })
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' })
    }
  }

  const patch = (id: string, p: Partial<EventDto>) =>
    setEvents((list) => (list || []).map((e) => (e.id === id ? { ...e, ...p } : e)))

  if (!events) return <Loading />
  return (
    <div>
      <h2 className="mb-4 text-lg font-black text-stone-800">Event Settings</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {events.map((ev) => (
          <EventEditor key={ev.id} ev={ev} patch={patch} save={save} />
        ))}
      </div>
    </div>
  )
}

function EventEditor({ ev, patch, save }: { ev: EventDto; patch: (id: string, p: Partial<EventDto>) => void; save: (ev: EventDto) => void }) {
  const icon = ev.type === 'CRICKET' ? Trophy : ev.type === 'FOOTBALL' ? Volleyball : ev.type === 'DRAWING' ? Palette : Droplet
  const Icon = icon
  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-blue-50 p-2"><Icon className="h-4 w-4 text-blue-800" /></span>
        <p className="flex-1 text-sm font-black text-stone-800">{ev.type}</p>
        <Switch checked={ev.active} onCheckedChange={(v) => patch(ev.id, { active: v })} id={`ev-active-${ev.id}`} />
        <Label htmlFor={`ev-active-${ev.id}`} className="text-xs">Active</Label>
      </div>
      <Field label="Title" value={ev.title} onChange={(e) => patch(ev.id, { title: e.target.value })} />
      <Field label="Date & Time (display text)" value={ev.eventDate || ''} onChange={(e) => patch(ev.id, { eventDate: e.target.value })} placeholder="e.g. 26th Jan 2025, 8 AM" />
      <Field label="Venue" value={ev.venue || ''} onChange={(e) => patch(ev.id, { venue: e.target.value })} />
      <Field label="Fee (₹) — 0 for free" type="number" value={String(ev.fee)} onChange={(e) => patch(ev.id, { fee: Number(e.target.value) })} />
      <Field label="Description" value={ev.description || ''} onChange={(e) => patch(ev.id, { description: e.target.value })} />
      <ImageUpload label="Banner Image" value={ev.bannerUrl} onChange={(url) => patch(ev.id, { bannerUrl: url })} />

      {/* ---- নিয়মাবলী + form customization (user side-এ সরাসরি দেখাবে) ---- */}
      <div className="space-y-2.5 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-3">
        <p className="text-[11px] font-black uppercase tracking-wider text-blue-900">নিয়মাবলী ও ফর্ম সেটিংস</p>
        <div className="space-y-1">
          <Label className="text-xs">নিয়মাবলী (Rules)</Label>
          <Textarea
            rows={4}
            value={ev.rules || ''}
            onChange={(e) => patch(ev.id, { rules: e.target.value })}
            placeholder={'প্রতি লাইনে একটি করে নিয়ম লিখুন — app-এ নম্বর দিয়ে দেখাবে\nযেমন: বয়স ১৮-৬০ বছরের মধ্যে হতে হবে\nখালি রাখলে এই অংশ দেখাবে না'}
          />
        </div>
        <Field
          label="Form Title (optional)"
          value={ev.formTitle || ''}
          onChange={(e) => patch(ev.id, { formTitle: e.target.value })}
          placeholder="ফর্মের শিরোনাম — খালি রাখলে default শিরোনাম"
        />
        <div className="space-y-1">
          <Label className="text-xs">Form Note (optional)</Label>
          <Textarea
            rows={2}
            value={ev.formNote || ''}
            onChange={(e) => patch(ev.id, { formNote: e.target.value })}
            placeholder="ফর্মের ভিতরে ছোট নোট/নির্দেশ দেখাতে চাইলে লিখুন"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Extra Form Fields (optional)</Label>
          <Textarea
            rows={3}
            value={ev.formFields || ''}
            onChange={(e) => patch(ev.id, { formFields: e.target.value })}
            placeholder={'প্রতি লাইনে একটি করে নতুন ফিল্ড (সর্বোচ্চ ১০)\nশেষে * দিলে সেটি required হবে\nযেমন: T-Shirt Size *'}
          />
          {(parseFormFields(ev.formFields).length || 0) > 0 && (
            <p className="text-[11px] font-semibold text-emerald-700">
              ✓ {parseFormFields(ev.formFields).length} টি extra ফিল্ড যুক্ত হবে
            </p>
          )}
        </div>
      </div>

      <Button size="sm" onClick={() => save(ev)} className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Save className="mr-1 h-4 w-4" /> Save Event</Button>
    </div>
  )
}

/* ---------------- quick actions ---------------- */

function QuickActionsTab() {
  const { toast } = useToast()
  const [actions, setActions] = useState<QuickActionDto[] | null>(null)
  const [editing, setEditing] = useState<Partial<QuickActionDto> | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiFetch('/api/admin/quick-actions').then((r) => r.json()).then((d) => setActions(d.actions || [])).catch(() => setActions([]))
  }, [])
  useEffect(load, [load])

  const save = async () => {
    if (!editing) return
    if (!editing.label) {
      toast({ title: 'Label is required', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const method = editing.id ? 'PUT' : 'POST'
      const res = await apiFetch('/api/admin/quick-actions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Quick action saved ✓' })
      setEditing(null)
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this quick action permanently?')) return
    const res = await apiFetch(`/api/admin/quick-actions?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast({ title: 'Delete failed — session expired?', variant: 'destructive' }); return }
    toast({ title: 'Quick action deleted' })
    load()
  }

  if (!actions) return <Loading />
  const PreviewIcon = QA_ICONS[editing?.icon || 'landmark'] || QA_ICONS.landmark
  const previewColor = QA_COLORS[editing?.color || 'violet'] || QA_COLORS.violet
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black text-stone-800">Quick Actions (Home Grid)</h2>
        <Button size="sm" onClick={() => setEditing({ label: '', icon: 'landmark', color: 'violet', link: 'committee', sortOrder: actions.length + 1, active: true })} className="rounded-full bg-blue-900 text-white hover:bg-blue-800">
          <LayoutGrid className="mr-1 h-4 w-4" /> Add Action
        </Button>
      </div>

      {editing && (
        <div className="mb-4 space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
          <Field label="Label *" value={editing.label || ''} onChange={(e) => setEditing((a) => ({ ...a, label: e.target.value }))} placeholder="e.g. পুজো কমিটি" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Icon</Label>
              <div className="flex items-center gap-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${previewColor.icon} text-white shadow`}>
                  <PreviewIcon className="h-4 w-4" />
                </span>
                <select value={editing.icon || 'landmark'} onChange={(e) => setEditing((a) => ({ ...a, icon: e.target.value }))} className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-sm outline-none focus:border-blue-400">
                  {QA_ICON_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                <span className={`h-6 w-6 shrink-0 rounded-full bg-gradient-to-br ${previewColor.icon} shadow`} />
                <select value={editing.color || 'violet'} onChange={(e) => setEditing((a) => ({ ...a, color: e.target.value }))} className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-sm outline-none focus:border-blue-400">
                  {QA_COLOR_KEYS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Link</Label>
              <select value={editing.link || 'committee'} onChange={(e) => setEditing((a) => ({ ...a, link: e.target.value }))} className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-sm outline-none focus:border-blue-400">
                {QA_LINKS.map((l) => (
                  <option key={l.key} value={l.key}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="w-28"><Field label="Sort Order" type="number" value={String(editing.sortOrder ?? 0)} onChange={(e) => setEditing((a) => ({ ...a, sortOrder: Number(e.target.value) }))} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={editing.active !== false} onCheckedChange={(v) => setEditing((a) => ({ ...a, active: v }))} id="qa-active" />
            <Label htmlFor="qa-active" className="text-xs">Active</Label>
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={save} className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Save className="mr-1 h-4 w-4" /> Save</Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="rounded-lg">Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((a) => {
          const Icon = QA_ICONS[a.icon] || QA_ICONS.landmark
          const color = QA_COLORS[a.color] || QA_COLORS.violet
          return (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${color.icon} text-white shadow`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-stone-800">{a.label}</p>
                <p className="truncate text-[11px] text-stone-400">{a.color} • {a.link} • #{a.sortOrder}</p>
              </div>
              {!a.active && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">INACTIVE</span>}
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(a)} aria-label="Edit" className="h-8 w-8 text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(a.id)} aria-label="Delete" className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- notices ---------------- */

/* ---------------- push notifications (Firebase) ---------------- */

function PushTab() {
  const { toast } = useToast()
  const [stats, setStats] = useState<{ tokens: number; configured: boolean } | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiFetch('/api/admin/notifications')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed')
        return r.json()
      })
      .then(setStats)
      .catch(() => setStats({ tokens: 0, configured: false }))
  }, [])
  useEffect(load, [load])

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: 'Title and message are required', variant: 'destructive' })
      return
    }
    if (!confirm('Send this push notification to ALL registered devices?')) return
    setBusy(true)
    try {
      const res = await apiFetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({
        title: `Sent to ${data.sent} device(s) ✓`,
        description: data.failed ? `${data.failed} failed` : undefined,
      })
      setTitle('')
      setBody('')
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Send failed', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-stone-800">Push Notifications (Firebase)</h2>
        <p className="text-xs text-stone-500">নোটিশ চালু করা প্রতিটি ডিভাইসে মেসেজ পাঠান (Firebase Cloud Messaging)।</p>
      </div>
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-black text-blue-900">{stats.tokens}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-stone-500">Registered Devices</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm">
            <p className={`text-2xl font-black ${stats.configured ? 'text-emerald-700' : 'text-amber-600'}`}>
              {stats.configured ? 'YES' : 'NO'}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-stone-500">Server Connected</p>
          </div>
        </div>
      )}
      {stats && !stats.configured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
          <p className="font-black">Server এখনো Firebase-এর সাথে connect হয়নি।</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            <li>Firebase Console → Project settings (⚙) → Service accounts → <b>Generate new private key</b></li>
            <li>ওই JSON ফাইলের পুরো লেখা <code className="rounded bg-white px-1">FIREBASE_SERVICE_ACCOUNT_KEY</code> env var-এ paste করুন (.env ফাইলে)</li>
            <li>Server restart দিন — তারপর এখানে থেকে সবাইকে notification পাঠাতে পারবেন</li>
          </ol>
          <p className="mt-2 font-semibold">মনে রাখবেন: user-দের ব্রাউজারে notification on করার জন্য Firebase Console → Cloud Messaging → Web Push certificates থেকে VAPID key নিয়ে <code className="rounded bg-white px-1">NEXT_PUBLIC_FIREBASE_VAPID_KEY</code>-তে দিতে হবে।</p>
        </div>
      )}
      <div className="max-w-xl space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <Field label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. কাল রক্তদান শিবির — সকাল ৯টা" maxLength={100} />
        <div className="space-y-1">
          <Label className="text-xs">Message *</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={500} placeholder="Notification-এর মূল লেখা…" className="text-sm" />
        </div>
        <Button onClick={send} disabled={busy} className="rounded-full bg-blue-900 text-white hover:bg-blue-800">
          {busy ? 'Sending…' : (<><BellRing className="mr-1.5 h-4 w-4" /> Send to All Devices</>)}
        </Button>
      </div>
    </div>
  )
}

function NoticesTab() {
  const { toast } = useToast()
  const [notices, setNotices] = useState<NoticeDto[] | null>(null)
  const [editing, setEditing] = useState<Partial<NoticeDto> | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiFetch('/api/admin/notices').then((r) => r.json()).then((d) => setNotices(d.notices || [])).catch(() => setNotices([]))
  }, [])
  useEffect(load, [load])

  const save = async () => {
    if (!editing) return
    if (!editing.title || !editing.body) {
      toast({ title: 'Title and body are required', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const method = editing.id ? 'PUT' : 'POST'
      const res = await apiFetch('/api/admin/notices', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Notice saved ✓' })
      setEditing(null)
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this notice permanently?')) return
    const res = await apiFetch(`/api/admin/notices?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast({ title: 'Delete failed — session expired?', variant: 'destructive' }); return }
    toast({ title: 'Notice deleted' })
    load()
  }

  if (!notices) return <Loading />
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black text-stone-800">Notices (Home Screen)</h2>
        <Button size="sm" onClick={() => setEditing({ title: '', body: '', active: true })} className="rounded-full bg-blue-900 text-white hover:bg-blue-800">
          <Bell className="mr-1 h-4 w-4" /> Add Notice
        </Button>
      </div>

      {editing && (
        <div className="mb-4 space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
          <Field label="Title *" value={editing.title || ''} onChange={(e) => setEditing((n) => ({ ...n, title: e.target.value }))} placeholder="e.g. আগামীকাল রক্তদান শিবির" />
          <div className="space-y-1">
            <Label className="text-xs">Body *</Label>
            <Textarea rows={4} value={editing.body || ''} onChange={(e) => setEditing((n) => ({ ...n, body: e.target.value }))} placeholder="Notice details..." className="text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={editing.active !== false} onCheckedChange={(v) => setEditing((n) => ({ ...n, active: v }))} id="notice-active" />
            <Label htmlFor="notice-active" className="text-xs">Active</Label>
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={save} className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Save className="mr-1 h-4 w-4" /> Save</Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="rounded-lg">Cancel</Button>
          </div>
        </div>
      )}

      {notices.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-400">No notices yet</p>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <div key={n.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-stone-900">{n.title}</p>
                  <p className="text-[11px] text-stone-400">{new Date(n.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                {!n.active && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">INACTIVE</span>}
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-stone-600">{n.body}</p>
              <div className="mt-2 flex justify-end gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(n)} aria-label="Edit" className="h-8 w-8 text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(n.id)} aria-label="Delete" className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- pujo info ---------------- */

const EMPTY_PUJO: Partial<PujoHighlightDto> = { badge: '', title: '', subtitle: '', location: '', dateText: '', imageUrl: '', detailImageUrl: '', active: true }

function PujoInfoTab() {
  const { toast } = useToast()
  const [form, setForm] = useState<Partial<PujoHighlightDto> | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiFetch('/api/admin/pujo-highlight')
      .then((r) => r.json())
      .then((d) => setForm(d.highlight || { ...EMPTY_PUJO }))
      .catch(() => setForm({ ...EMPTY_PUJO }))
  }, [])
  useEffect(load, [load])

  const save = async () => {
    if (!form) return
    if (!form.title || !form.imageUrl) {
      toast({ title: 'Title and image are required', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const res = await apiFetch('/api/admin/pujo-highlight', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Pujo info saved ✓' })
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  if (!form) return <Loading />
  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-black text-stone-800">Pujo Highlight</h2>
      <p className="mb-4 mt-1 text-xs text-stone-500">এই তথ্যগুলো হোম স্ক্রিনের &ldquo;শ্রী শ্রী শ্যামা পুজা&rdquo; ব্যানারে দেখানো হয়।</p>
      <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Badge" value={form.badge || ''} onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))} placeholder="e.g. সর্বজনীন পুজা ২০২৫" />
          <Field label="Title *" value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="শ্রী শ্রী শ্যামা পুজা" />
        </div>
        <Field label="Subtitle" value={form.subtitle || ''} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="Small line below title" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Location" value={form.location || ''} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. দক্ষিণ গোবিন্দপুর ক্লাব মাঠ" />
          <Field label="Date (display text)" value={form.dateText || ''} onChange={(e) => setForm((f) => ({ ...f, dateText: e.target.value }))} placeholder="e.g. ২১ অক্টোবর, সন্ধ্যা ৮টা" />
        </div>
        <ImageUpload label="Pujo Image (left-side photo) *" value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
        <ImageUpload label="Detail Image (invitation card for details dialog)" value={form.detailImageUrl || undefined} onChange={(url) => setForm((f) => ({ ...f, detailImageUrl: url }))} />
        <div className="flex items-center gap-2">
          <Switch checked={form.active !== false} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} id="pujo-active" />
          <Label htmlFor="pujo-active" className="text-xs">Active</Label>
        </div>
        <Button disabled={busy} onClick={save} className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Save className="mr-1 h-4 w-4" /> {busy ? 'Saving...' : 'Save'}</Button>
      </div>
    </div>
  )
}

/* ---------------- gallery ---------------- */

function GalleryTab() {
  const { toast } = useToast()
  const [photos, setPhotos] = useState<GalleryPhotoDto[] | null>(null)
  const [year, setYear] = useState('2025')
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const multiRef = useRef<HTMLInputElement>(null)
  const [multiBusy, setMultiBusy] = useState(false)
  const [multiProgress, setMultiProgress] = useState('')

  const load = useCallback(() => {
    apiFetch('/api/admin/gallery').then((r) => r.json()).then((d) => setPhotos(d.photos || [])).catch(() => setPhotos([]))
  }, [])
  useEffect(load, [load])

  const add = async () => {
    if (!/^\d{4}$/.test(year) || !imageUrl) {
      toast({ title: 'Valid year and photo are required', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const res = await apiFetch('/api/admin/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, caption, imageUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Photo added ✓' })
      setCaption('')
      setImageUrl('')
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this photo permanently?')) return
    const res = await apiFetch(`/api/admin/gallery?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast({ title: 'Delete failed — session expired?', variant: 'destructive' }); return }
    toast({ title: 'Photo deleted' })
    load()
  }

  // bulk upload: same year + caption for every selected photo, one by one
  const uploadMany = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    if (!/^\d{4}$/.test(year)) {
      toast({ title: 'আগে সঠিক বছর (Year) লিখুন', variant: 'destructive' })
      return
    }
    setMultiBusy(true)
    let ok = 0
    try {
      for (let i = 0; i < files.length; i++) {
        setMultiProgress(`${i + 1}/${files.length}`)
        const fd = new FormData()
        fd.set('file', files[i])
        const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
        const ud = await up.json()
        if (!up.ok) throw new Error(ud.error || 'Upload failed')
        const res = await apiFetch('/api/admin/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year, caption, imageUrl: ud.url }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to save')
        ok++
      }
      toast({ title: `${ok} টি ছবি যোগ হয়েছে ✓` })
      setCaption('')
      load()
    } catch (err) {
      toast({
        title: `${ok} টি হয়েছে, এরপর ব্যর্থ — ${err instanceof Error ? err.message : 'error'}`,
        variant: 'destructive',
      })
    } finally {
      setMultiBusy(false)
      setMultiProgress('')
      if (multiRef.current) multiRef.current.value = ''
    }
  }

  if (!photos) return <Loading />
  return (
    <div>
      <h2 className="mb-4 text-lg font-black text-stone-800">Year-wise Gallery</h2>
      <div className="mb-4 grid gap-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:grid-cols-3">
        <Field label="Year *" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025" />
        <Field label="Caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Annual Sports Day" />
        <ImageUpload label="Photo *" value={imageUrl} onChange={setImageUrl} />
        <div className="sm:col-span-3 flex flex-wrap items-center gap-2">
          <Button disabled={busy} onClick={add} className="rounded-lg bg-blue-900 text-white hover:bg-blue-800"><ImagePlus className="mr-1 h-4 w-4" /> Add to Gallery</Button>
          <Button type="button" disabled={multiBusy} onClick={() => multiRef.current?.click()} variant="outline" className="rounded-lg border-blue-300 text-blue-900 hover:bg-blue-100">
            <ImageUp className="mr-1 h-4 w-4" /> {multiBusy ? `আপলোড হচ্ছে... (${multiProgress})` : 'একসাথে অনেকগুলো ছবি আপলোড'}
          </Button>
          <input ref={multiRef} type="file" accept="image/*" multiple onChange={uploadMany} className="hidden" aria-label="Upload multiple photos" />
        </div>
        <p className="sm:col-span-3 text-[10px] text-stone-500">💡 একসাথে অনেক ছবি বাছলে সবগুলো একই Year (ও Caption) দিয়ে যোগ হবে।</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            { }
            <img src={p.imageUrl} alt={p.caption || ''} className="aspect-square w-full object-cover" />
            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-black text-amber-300">{p.year}</span>
            <button onClick={() => remove(p.id)} aria-label="Delete photo" className="absolute right-1.5 top-1.5 rounded-full bg-red-600 p-1.5 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {p.caption && <p className="truncate px-2 py-1.5 text-[10px] font-medium text-stone-500">{p.caption}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- settings ---------------- */

function SettingsTab() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<Record<string, string> | null>(null)
  const [busy, setBusy] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [resetArm, setResetArm] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)

  useEffect(() => {
    apiFetch('/api/admin/settings').then((r) => r.json()).then((d) => setSettings(d.settings || {})).catch(() => setSettings({}))
  }, [])

  if (!settings) return <Loading />

  const runRestore = async () => {
    if (!confirm('ডেমো কনটেন্ট ফিরিয়ে আনবেন?\n\nHome page-এর ডেমো banner, পুজো কমিটি/খেলা টুর্নামেন্ট button, শ্রী শ্রী শ্যামা পুজার banner, কমিটি সদস্য (ছবিসহ), নোটিশ, ইভেন্ট ও গ্যালারি ফিরে আসবে।\n\nআপনার নিজের যোগ করা banner/সদস্য/setting কিছুই মুছবে না।')) return
    setRestoreBusy(true)
    try {
      const res = await apiFetch('/api/admin/restore-demo', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: data.message || 'রিস্টোর সম্পন্ন ✓' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Restore failed', variant: 'destructive' })
    } finally {
      setRestoreBusy(false)
    }
  }

  // danger zone: two-step arm-then-confirm (second press within 6s fires it)
  const runResetUsers = async () => {
    if (!resetArm) {
      setResetArm(true)
      setTimeout(() => setResetArm(false), 6000)
      return
    }
    setResetArm(false)
    setResetBusy(true)
    try {
      const res = await apiFetch('/api/admin/reset-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: data.message || 'সব user মুছে ফেলা হয়েছে ✓' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Reset failed', variant: 'destructive' })
    } finally {
      setResetBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Settings saved ✓' })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Save failed', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const fields: { key: string; label: string; hint?: string }[] = [
    { key: 'memberFee', label: 'Member Joining Fee (₹)', hint: 'Shown on Member Join page' },
    { key: 'upiId', label: 'UPI ID (payment)', hint: 'e.g. bassangha@ybl — GPay / PhonePe এ টাকা আসবে এখানে' },
    { key: 'upiName', label: 'UPI Payee Name', hint: 'Name shown in payment apps' },
    { key: 'headerTagline', label: 'Header Tagline', hint: 'e.g. Tradition · Culture · Community' },
    { key: 'headerQuote', label: 'Header Quote (Bengali)', hint: 'e.g. একসাথে আমরা, একসাথে শক্তি' },
    { key: 'memberJoinSubtitle', label: 'Member Join Subtitle', hint: 'Bengali text under the Member Join button' },
    { key: 'clubAddress', label: 'Club Address' },
    { key: 'resetCode', label: 'Admin Reset Code (secret)', hint: 'Admin account-er password reset করতে এই code লাগবে — কাউকে দেবেন না। ফাঁকা রাখলে admin reset disabled থাকবে।' },
  ]

  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-lg font-black text-stone-800">App Settings</h2>
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs">{f.label}</Label>
          <Input
            value={settings[f.key] || ''}
            onChange={(e) => setSettings((s) => ({ ...(s || {}), [f.key]: e.target.value }))}
            className="h-10"
          />
          {f.hint && <p className="text-[10px] text-stone-400">{f.hint}</p>}
        </div>
      ))}
      <Button disabled={busy} onClick={save} className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
        <Save className="mr-1 h-4 w-4" /> {busy ? 'Saving...' : 'Save Settings'}
      </Button>

      <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
        <p className="text-sm font-black text-blue-900">♻️ ডেমো কনটেন্ট রিস্টোর</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-900/80">
          Home page-এর ডেমো banner, পুজো কমিটি / খেলা টুর্নামেন্ট button, শ্রী শ্রী শ্যামা পুজার banner, কমিটি সদস্য (আপলোড করা ছবিসহ), নোটিশ, ইভেন্ট ও গ্যালারি ফিরিয়ে আনে। আপনার নিজের যোগ করা কোনো banner, সদস্য বা setting মুছবে না — দ্বিতীয়বার চাপলেও কিছু নষ্ট হবে না।
        </p>
        <Button disabled={restoreBusy} onClick={runRestore} className="mt-3 rounded-lg bg-blue-900 text-white hover:bg-blue-800">
          <Sparkles className="mr-1 h-4 w-4" /> {restoreBusy ? 'ফিরিয়ে আনা হচ্ছে...' : 'এখনই রিস্টোর করুন'}
        </Button>
      </div>
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-black text-red-900">⚠️ Danger Zone — সব Registered User মুছে ফেলুন</p>
        <p className="mt-1 text-xs leading-relaxed text-red-900/80">
          অ্যাপের সব registered user, সব donation, member/tournament/drawing/blood request এবং notification token একসাথে মুছে যাবে — member list একদম নতুনের মতো ফাঁকা হবে। আপনার নিজের admin account আর অ্যাপের কনটেন্ট (banner / কমিটি / নোটিশ / gallery) অটুট থাকবে। <b>এটা আর ফেরানো যাবে না!</b>
        </p>
        <Button disabled={resetBusy} onClick={runResetUsers} className="mt-3 rounded-lg bg-red-600 text-white hover:bg-red-700">
          <Trash2 className="mr-1 h-4 w-4" /> {resetBusy ? 'মুছে ফেলা হচ্ছে...' : resetArm ? '⚠️ নিশ্চিত? আবার চাপুন' : 'সব User মুছুন (রিসেট)'}
        </Button>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <p className="font-black">ℹ️ Info</p>
        <p className="mt-1">
          • Payment এখন দুই রকম — <b>QR/UPI</b> (UTR জমা দেয়) অথবা <b>Cash (নগদ)</b>। Cash entry-তে টাকা হাতে পেয়ে &ldquo;Cash পেয়েছি — Approve&rdquo; চাপবেন, UTR থাকবে না।<br />
          • UTR পেমেন্ট approve/reject করতে &ldquo;Member Requests&rdquo; বা &ldquo;Tournaments&rdquo; tab ব্যবহার করুন।<br />
          • Drawing entry fee ₹30 (Events tab-এ DRAWING fee বদলালে সেটাই কাটবে) — user form জমিয়ে QR pay বা Cash বেছে নেবে, তারপর এখানে approve করবেন।<br />
          • <b>Reports</b> tab থেকে সব service-এর approve হওয়া Cash/Online হিসেব date-range দিয়ে <b>PDF</b> download করা যায়।<br />
          • Blood Donation এ fee নেই — সেটা শুধু registration।<br />
          • এখানে পরিবর্তন করলে সাথে সাথেই user side এ দেখা যাবে।
        </p>
      </div>
    </div>
  )
}
