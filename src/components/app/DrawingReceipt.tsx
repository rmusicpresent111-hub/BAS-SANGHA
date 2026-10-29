'use client'

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { BadgeCheck, CalendarDays, Download, GraduationCap, IndianRupee, Loader2, Palette, Phone, Share2, User, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { formatINR } from './common'

export interface DrawingReceiptData {
  id: string
  name: string
  fatherName: string
  className: string
  schoolName: string
  phone: string
  fee: number
  utr?: string | null
  paymentMethod?: string | null // QR (UPI online) | CASH
  status: string // UNPAID | WAITING | APPROVED | REJECTED
  createdAt: string
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  UNPAID: { label: 'PAYMENT PENDING', cls: 'bg-stone-100 text-stone-600' },
  WAITING: { label: 'UNDER VERIFICATION', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'ENTRY CONFIRMED ✓', cls: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'ENTRY REJECTED', cls: 'bg-red-100 text-red-700' },
}

/**
 * Printable Drawing Competition entry receipt (B.A.S Sangha) with
 * download-as-PNG + Web Share. Shown in the user's Drawing screen after the
 * admin approves the paid entry — every value comes from the server.
 */
export default function DrawingReceipt({ entry }: { entry: DrawingReceiptData }) {
  const ref = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [sharing, setSharing] = useState(false)

  const status = STATUS_MAP[entry.status] || STATUS_MAP.WAITING
  const isCash = String(entry.paymentMethod || '').toUpperCase() === 'CASH'
  const date = new Date(entry.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const shortId = `BAS-D-${entry.id.slice(-6).toUpperCase()}`

  const receiptText = [
    'ভোরের আলো সংঘ (B.A.S Sangha) — Drawing Competition Receipt',
    `Participant: ${entry.name} (Class ${entry.className})`,
    `Entry Fee: ₹${entry.fee.toLocaleString('en-IN')} (${status.label})`,
    `Mobile: ${entry.phone}`,
    `Entry ID: ${shortId}`,
    isCash ? 'Payment: CASH (নগদ টাকা)' : entry.utr ? `UTR: ${entry.utr}` : '',
    `Date: ${date}`,
    'Dakshin Gobindapur • Estd 2021',
  ]
    .filter(Boolean)
    .join('\n')

  const renderPng = async () => {
    const node = ref.current
    if (!node) throw new Error('receipt not ready')
    const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true })
    const blob = await (await fetch(dataUrl)).blob()
    return new File([blob], `BAS-Drawing-${shortId}.png`, { type: 'image/png' })
  }

  const handleDownload = async () => {
    const node = ref.current
    if (!node || downloading) return
    setDownloading(true)
    try {
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `BAS-Drawing-${shortId}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast({ title: 'Receipt downloaded ✓' })
    } catch {
      toast({ title: 'Download failed — please try again', variant: 'destructive' })
    } finally {
      setDownloading(false)
    }
  }

  /** Share the receipt image via WhatsApp etc. (Web Share API); falls back to copying the details. */
  const handleShare = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const file = await renderPng()
      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean
      }
      if (typeof navigator.share === 'function' && nav.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Drawing Competition Receipt — B.A.S Sangha',
          text: `ভোরের আলো সংঘ — Drawing Competition entry receipt (${entry.name})`,
        })
        toast({ title: 'Receipt shared ✓' })
      } else {
        await navigator.clipboard.writeText(receiptText)
        toast({ title: 'This device can\'t share images — receipt details copied instead ✓' })
      }
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return // user closed the share sheet
      try {
        await navigator.clipboard.writeText(receiptText)
        toast({ title: 'Receipt details copied — paste anywhere to share ✓' })
      } catch {
        toast({ title: 'Share failed — please Download the receipt and share it', variant: 'destructive' })
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[350px]">
      <div
        ref={ref}
        style={{ containerType: 'inline-size' }}
        className="@container relative overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-amber-300"
      >
        {/* header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-900 via-amber-800 to-amber-700 px-[4cqw] py-[3.4cqw]">
          <span aria-hidden className="pointer-events-none absolute -right-[8cqw] -top-[14cqw] h-[34cqw] w-[34cqw] rounded-full border border-amber-200/25" />
          <div className="flex items-center gap-[2.6cqw]">
            <img
              src="/logo.png"
              alt="B.A.S Sangha logo"
              className="h-[11cqw] w-[11cqw] shrink-0 rounded-full bg-white object-cover p-[0.6cqw] ring-2 ring-amber-200/80"
            />
            <div className="min-w-0">
              <p className="text-[5cqw] font-black leading-[1.25] text-white">ভোরের আলো সংঘ</p>
              <p className="text-[2.8cqw] font-bold uppercase leading-[1.3] tracking-[0.3em] text-amber-200">B.A.S Sangha</p>
            </div>
          </div>
          <p className="mt-[1.6cqw] flex items-center gap-[1.4cqw] text-[2.6cqw] font-bold uppercase tracking-[0.22em] text-amber-100">
            <Palette className="h-[3.2cqw] w-[3.2cqw]" /> Drawing Competition — Entry Receipt
          </p>
        </div>

        {/* fee strip */}
        <div className="flex items-center justify-between border-b-2 border-dashed border-stone-200 bg-amber-50/70 px-[4cqw] py-[3cqw]">
          <div>
            <p className="text-[2.5cqw] font-bold uppercase tracking-wider text-stone-400">Entry Fee Paid</p>
            <p className="flex items-center text-[8.5cqw] font-black leading-tight text-stone-900">
              <IndianRupee className="h-[6cqw] w-[6cqw] stroke-[3]" strokeWidth={3} />
              {entry.fee.toLocaleString('en-IN')}
            </p>
          </div>
          <span className={`rounded-full px-[3cqw] py-[1.4cqw] text-[2.7cqw] font-black tracking-wide ${status.cls}`}>
            {status.label}
          </span>
        </div>

        {/* details */}
        <div className="space-y-[2.6cqw] px-[4cqw] py-[3.4cqw]">
          <Row icon={User} label="Participant" value={entry.name} />
          <Row icon={Users} label="Father's Name" value={entry.fatherName} />
          <Row icon={GraduationCap} label="Class & School" value={`${entry.className} • ${entry.schoolName}`} />
          <Row icon={Phone} label="Mobile" value={entry.phone} />
          <Row icon={BadgeCheck} label="Entry ID" value={shortId} mono />
          {isCash ? (
            <Row icon={Wallet} label="Payment Method" value="Cash (নগদ টাকা)" />
          ) : entry.utr ? (
            <Row icon={BadgeCheck} label="UPI Transaction ID (UTR)" value={entry.utr} mono />
          ) : null}
          <Row icon={CalendarDays} label="Date & Time" value={date} />
        </div>

        {/* footer */}
        <div className="border-t border-dashed border-stone-200 bg-stone-50 px-[4cqw] py-[2.6cqw] text-center">
          <p className="text-[2.5cqw] font-semibold leading-relaxed text-stone-500">
            ধন্যবাদ! অংশগ্রহণের জন্য — event দিন রঙ-ব্রাশ নিয়ে আসুন 🎨
          </p>
          <p className="mt-[1cqw] text-[2.2cqw] text-stone-400">Dakshin Gobindapur • Estd 2021 • computer generated receipt</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          onClick={handleShare}
          disabled={sharing}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-4 text-sm font-bold text-white hover:from-emerald-700 hover:to-emerald-600"
        >
          {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
          {sharing ? 'Preparing…' : 'Share Receipt'}
        </Button>
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="rounded-xl bg-gradient-to-r from-amber-700 to-amber-600 py-4 text-sm font-bold text-white hover:from-amber-800 hover:to-amber-700"
        >
          {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {downloading ? 'Generating…' : 'Download'}
        </Button>
      </div>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof User
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-[2cqw]">
      <span className="flex shrink-0 items-center gap-[1.6cqw] text-[2.6cqw] font-semibold text-stone-400">
        <Icon className="h-[3.4cqw] w-[3.4cqw]" /> {label}
      </span>
      <span
        className={`min-w-0 truncate text-right text-[3cqw] font-bold text-stone-800 ${mono ? 'font-mono tracking-tight' : ''}`}
      >
        {value || '—'}
      </span>
    </div>
  )
}
