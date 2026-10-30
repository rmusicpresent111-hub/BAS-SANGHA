'use client'

import { useRef, useState } from 'react'
import {
  BadgeCheck,
  CalendarDays,
  Download,
  IndianRupee,
  Loader2,
  MapPin,
  Phone,
  Share2,
  Trophy,
  User,
  Users,
  Wallet,
  Volleyball,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import type { TournamentRequestDto } from '@/lib/types'
import { extraDataRows } from '@/lib/extra-data'
import { downloadNodePdf, nodeToJpegFile, shareReceipt } from '@/lib/receipt-share'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  WAITING: { label: 'UNDER VERIFICATION', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'ENTRY CONFIRMED ✓', cls: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'ENTRY REJECTED', cls: 'bg-red-100 text-red-700' },
}

/**
 * Printable Cricket/Football entry receipt (B.A.S Sangha) — download as PDF
 * (device storage) + WhatsApp JPEG share. Shown on the tournament status step
 * once the entry fee is submitted (QR or Cash) — every value comes from the
 * server.
 */
export default function TournamentReceipt({
  request,
  eventTitle,
  eventDate,
  venue,
}: {
  request: TournamentRequestDto
  eventTitle?: string
  eventDate?: string | null
  venue?: string | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [sharing, setSharing] = useState(false)

  const isCricket = request.type === 'CRICKET'
  const status = STATUS_MAP[request.status] || STATUS_MAP.WAITING
  const isCash = String(request.paymentMethod || '').toUpperCase() === 'CASH'
  const teamId = `BAS-${isCricket ? 'CT' : 'FT'}-${request.id.slice(-6).toUpperCase()}`
  const date = new Date(request.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const details = [
    { label: 'Team Name', value: request.teamName },
    { label: 'Tournament', value: eventTitle || (isCricket ? 'Cricket Tournament' : 'Football Tournament') },
    ...(eventDate ? [{ label: 'Date', value: eventDate }] : []),
    ...(venue ? [{ label: 'Venue', value: venue }] : []),
    { label: "Captain's Phone", value: request.phone },
    ...extraDataRows(request.extraData),
  ]

  const receiptText = [
    `ভোরের আলো সংঘ (B.A.S Sangha) — ${isCricket ? 'Cricket' : 'Football'} Tournament Receipt`,
    `Team: ${request.teamName}`,
    ...details.map((d) => `${d.label}: ${d.value}`),
    `Team ID: ${teamId}`,
    `Entry Fee: ₹${request.fee.toLocaleString('en-IN')} (${status.label})`,
    isCash ? 'Payment: CASH (নগদ টাকা)' : request.utr ? `UTR: ${request.utr}` : '',
    `Date: ${date}`,
    'Dakshin Gobindapur • Estd 2021',
  ]
    .filter(Boolean)
    .join('\n')

  const pdfName = `BAS-${isCricket ? 'Cricket' : 'Football'}-${teamId}.pdf`
  const jpgName = `BAS-${isCricket ? 'Cricket' : 'Football'}-${teamId}.jpg`

  /** Download the receipt as a PDF file → saved to the device storage. */
  const handleDownload = async () => {
    const node = ref.current
    if (!node || downloading) return
    setDownloading(true)
    try {
      const outcome = await downloadNodePdf(node, pdfName)
      if (outcome === 'saved') toast({ title: 'Receipt PDF saved to Downloads ✓' })
      else if (outcome === 'shared') toast({ title: 'Receipt PDF ready — choose an app to save/share ✓' })
      else toast({ title: 'Receipt PDF saved to device ✓ (Downloads folder)' })
    } catch (err) {
      toast({
        title: err instanceof Error && err.message ? err.message : 'Download failed — please try again',
        variant: 'destructive',
      })
    } finally {
      setDownloading(false)
    }
  }

  /** Share the receipt image — WhatsApp first (share sheet, then direct WhatsApp). */
  const handleShare = async () => {
    const node = ref.current
    if (!node || sharing) return
    setSharing(true)
    try {
      const file = await nodeToJpegFile(node, jpgName)
      const outcome = await shareReceipt({
        file,
        title: `${isCricket ? 'Cricket' : 'Football'} Tournament Receipt — B.A.S Sangha`,
        text: `ভোরের আলো সংঘ — ${isCricket ? 'Cricket' : 'Football'} entry receipt (${request.teamName})`,
        whatsappText: receiptText,
      })
      if (outcome === 'shared') toast({ title: 'Receipt shared ✓' })
      else if (outcome === 'whatsapp') toast({ title: 'WhatsApp opened — send it to anyone ✓' })
      else if (outcome === 'copied') toast({ title: "Receipt details copied — paste anywhere to share ✓" })
      else if (outcome === 'failed')
        toast({ title: 'Share failed — please Download the receipt and share it', variant: 'destructive' })
    } catch (err) {
      console.error('tournament receipt share failed', err)
      toast({ title: 'Share failed — please Download the receipt and share it', variant: 'destructive' })
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
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 px-[4cqw] py-[3.4cqw]">
          <span aria-hidden className="pointer-events-none absolute -right-[8cqw] -top-[14cqw] h-[34cqw] w-[34cqw] rounded-full border border-amber-300/20" />
          <div className="flex items-center gap-[2.6cqw]">
            <img
              src="/logo.png"
              alt="B.A.S Sangha logo"
              className="h-[11cqw] w-[11cqw] shrink-0 rounded-full bg-white object-cover p-[0.6cqw] ring-2 ring-amber-300/80"
            />
            <div className="min-w-0">
              <p className="text-[5cqw] font-black leading-[1.25] text-white">ভোরের আলো সংঘ</p>
              <p className="text-[2.8cqw] font-bold uppercase leading-[1.3] tracking-[0.3em] text-amber-300">B.A.S Sangha</p>
            </div>
          </div>
          <p className="mt-[1.6cqw] flex items-center gap-[1.4cqw] text-[2.6cqw] font-bold uppercase tracking-[0.22em] text-blue-200">
            {isCricket ? <Trophy className="h-[3.2cqw] w-[3.2cqw]" /> : <Volleyball className="h-[3.2cqw] w-[3.2cqw]" />}
            {isCricket ? 'Cricket' : 'Football'} Tournament — Entry Receipt
          </p>
        </div>

        {/* fee strip */}
        <div className="flex items-center justify-between border-b-2 border-dashed border-stone-200 bg-amber-50/70 px-[4cqw] py-[3cqw]">
          <div>
            <p className="text-[2.5cqw] font-bold uppercase tracking-wider text-stone-400">Entry Fee Paid</p>
            <p className="flex items-center text-[8.5cqw] font-black leading-tight text-stone-900">
              <IndianRupee className="h-[6cqw] w-[6cqw] stroke-[3]" strokeWidth={3} />
              {request.fee.toLocaleString('en-IN')}
            </p>
          </div>
          <span className={`rounded-full px-[3cqw] py-[1.4cqw] text-[2.7cqw] font-black tracking-wide ${status.cls}`}>
            {status.label}
          </span>
        </div>

        {/* details */}
        <div className="space-y-[2.6cqw] px-[4cqw] py-[3.4cqw]">
          <Row icon={Users} label="Team Name" value={request.teamName} />
          <Row icon={Trophy} label="Tournament" value={eventTitle || (isCricket ? 'Cricket Tournament' : 'Football Tournament')} />
          {eventDate ? <Row icon={CalendarDays} label="Date" value={eventDate} /> : null}
          {venue ? <Row icon={MapPin} label="Venue" value={venue} /> : null}
          <Row icon={Phone} label="Captain's Phone" value={request.phone} />
          {extraDataRows(request.extraData).map((d) => (
            <Row key={d.label} icon={User} label={d.label} value={d.value} />
          ))}
          <Row icon={BadgeCheck} label="Team ID" value={teamId} mono />
          {isCash ? (
            <Row icon={Wallet} label="Payment Method" value="Cash (নগদ টাকা)" />
          ) : request.utr ? (
            <Row icon={BadgeCheck} label="UPI Transaction ID (UTR)" value={request.utr} mono />
          ) : null}
          <Row icon={CalendarDays} label="Registered On" value={date} />
        </div>

        {/* footer */}
        <div className="border-t border-dashed border-stone-200 bg-stone-50 px-[4cqw] py-[2.6cqw] text-center">
          <p className="text-[2.5cqw] font-semibold leading-relaxed text-stone-500">
            ধন্যবাদ! মাঠে শান্ত থেকে খেলো — জয় আমাদেরই হবে 🏆
          </p>
          <p className="mt-[1cqw] text-[2.2cqw] text-stone-400">Dakshin Gobindapur • Estd 2021 • computer generated receipt</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          onClick={handleShare}
          disabled={sharing}
          className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 py-4 text-sm font-bold text-white hover:from-green-700 hover:to-emerald-600"
        >
          {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
          {sharing ? 'Preparing…' : 'WhatsApp Share'}
        </Button>
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="rounded-xl bg-gradient-to-r from-blue-900 to-blue-800 py-4 text-sm font-bold text-white hover:from-blue-800 hover:to-blue-700"
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
