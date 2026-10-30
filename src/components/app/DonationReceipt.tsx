'use client'

import { useRef, useState } from 'react'
import { BadgeCheck, CalendarDays, Download, Fingerprint, IndianRupee, Loader2, Phone, Share2, User, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { downloadNodePdf, nodeToJpegFile, shareReceipt } from '@/lib/receipt-share'
import { formatINR } from './common'

export interface DonationReceiptData {
  orderId: string
  amount: number
  status: string // PENDING | SUBMITTED | VERIFIED | REJECTED
  payerName: string
  payerPhone: string
  utr?: string | null
  paymentMethod?: string | null // QR (UPI online) | CASH
  note?: string | null
  createdAt: string
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'PAYMENT PENDING', cls: 'bg-stone-100 text-stone-600' },
  SUBMITTED: { label: 'UNDER VERIFICATION', cls: 'bg-amber-100 text-amber-800' },
  VERIFIED: { label: 'PAYMENT VERIFIED ✓', cls: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'PAYMENT REJECTED', cls: 'bg-red-100 text-red-700' },
}

/**
 * Printable donation receipt (B.A.S Sangha) with download-as-PDF (device
 * storage) + WhatsApp JPEG share. Shared by the donor flow (DonationDialog)
 * and the Admin "Donations" tab — every value comes from the server, never
 * from client input.
 */
export default function DonationReceipt({ donation, compact }: { donation: DonationReceiptData; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [sharing, setSharing] = useState(false)

  const isCash = String(donation.paymentMethod || '').toUpperCase() === 'CASH'
  const status = STATUS_MAP[donation.status] || STATUS_MAP.PENDING
  const date = new Date(donation.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const receiptText = [
    'ভোরের আলো সংঘ (B.A.S Sangha) — Donation Receipt',
    `Amount: ₹${donation.amount.toLocaleString('en-IN')} (${status.label})`,
    `Donor: ${donation.payerName}`,
    donation.payerPhone ? `Phone: ${donation.payerPhone}` : '',
    `Order ID: ${donation.orderId}`,
    isCash ? 'Payment: CASH (নগদ টাকা)' : donation.utr ? `UTR: ${donation.utr}` : '',
    `Date: ${date}`,
    'Dakshin Gobindapur • Estd 2021',
  ]
    .filter(Boolean)
    .join('\n')

  const pdfName = `BAS-Donation-${donation.orderId}.pdf`
  const jpgName = `BAS-Donation-${donation.orderId}.jpg`

  /** Download the receipt as a PDF file → saved to the device storage. */
  const handleDownload = async () => {
    const node = ref.current
    if (!node || downloading) return
    setDownloading(true)
    try {
      await downloadNodePdf(node, pdfName)
      toast({ title: 'Receipt PDF saved to device ✓ (Downloads folder)' })
    } catch {
      toast({ title: 'Download failed — please try again', variant: 'destructive' })
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
        title: 'Donation Receipt — B.A.S Sangha',
        text: `ভোরের আলো সংঘ (B.A.S Sangha) — donation receipt ₹${donation.amount.toLocaleString('en-IN')}`,
        whatsappText: receiptText,
      })
      if (outcome === 'shared') toast({ title: 'Receipt shared ✓' })
      else if (outcome === 'whatsapp') toast({ title: 'WhatsApp opened — send it to anyone ✓' })
      else if (outcome === 'copied') toast({ title: 'Receipt details copied — paste anywhere to share ✓' })
      else if (outcome === 'failed')
        toast({ title: 'Share failed — please Download the receipt and share it', variant: 'destructive' })
    } catch {
      toast({ title: 'Share failed — please Download the receipt and share it', variant: 'destructive' })
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className={compact ? 'w-full max-w-[320px]' : 'mx-auto w-full max-w-[350px]'}>
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
          <p className="mt-[1.6cqw] text-[2.6cqw] font-bold uppercase tracking-[0.22em] text-blue-200">Donation Receipt</p>
        </div>

        {/* amount strip */}
        <div className="flex items-center justify-between border-b-2 border-dashed border-stone-200 bg-amber-50/70 px-[4cqw] py-[3cqw]">
          <div>
            <p className="text-[2.5cqw] font-bold uppercase tracking-wider text-stone-400">Amount Received</p>
            <p className="flex items-center text-[8.5cqw] font-black leading-tight text-stone-900">
              <IndianRupee className="h-[6cqw] w-[6cqw] stroke-[3]" strokeWidth={3} />
              {donation.amount.toLocaleString('en-IN')}
            </p>
          </div>
          <span className={`rounded-full px-[3cqw] py-[1.4cqw] text-[2.7cqw] font-black tracking-wide ${status.cls}`}>
            {status.label}
          </span>
        </div>

        {/* details */}
        <div className="space-y-[2.6cqw] px-[4cqw] py-[3.4cqw]">
          <Row icon={User} label="Donor Name" value={donation.payerName} />
          {donation.payerPhone ? <Row icon={Phone} label="Phone" value={donation.payerPhone} /> : null}
          <Row icon={Fingerprint} label="Payment Order ID" value={donation.orderId} mono />
          {isCash ? (
            <Row icon={Wallet} label="Payment Method" value="Cash (নগদ টাকা)" />
          ) : donation.utr ? (
            <Row icon={BadgeCheck} label="UPI Transaction ID (UTR)" value={donation.utr} mono />
          ) : null}
          <Row icon={CalendarDays} label="Date & Time" value={date} />
          {donation.note ? <Row icon={BadgeCheck} label="Committee Note" value={donation.note} /> : null}
        </div>

        {/* footer */}
        <div className="border-t border-dashed border-stone-200 bg-stone-50 px-[4cqw] py-[2.6cqw] text-center">
          <p className="text-[2.5cqw] font-semibold leading-relaxed text-stone-500">
            ধন্যবাদ! আপনার সহযোগিতাই আমাদের পুজো ও সমাজসেবা সামনে রাখবে 🙏
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
