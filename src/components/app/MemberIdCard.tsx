'use client'

import { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { toPng } from 'html-to-image'
import { BadgeCheck, Download, IdCard, Loader2, MapPin, Phone, Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { dataUrlToBlob, saveBlobToDevice } from '@/lib/receipt-share'

export interface MemberIdCardProps {
  name: string
  phone: string
  address: string
  photoUrl: string
  cardNumber: string
  /** admin-approved member → gold premium seal on the card (default true) */
  approved?: boolean
}

/**
 * Digital membership ID card (CR80 ratio) with download-as-PNG.
 *
 * The card is a fixed-aspect "printed" artifact, so every internal size uses
 * container-query units (cqw) against the card itself (@container): at the
 * 350px max width 1cqw = 3.5px (e.g. text-[4.1cqw] = 14.35px), and on slightly
 * narrower phones the whole card scales down proportionally like an image
 * instead of reflowing. html-to-image copies computed (px) styles into the
 * clone, so the exported PNG matches exactly what is on screen.
 */
export default function MemberIdCard({ name, phone, address, photoUrl, cardNumber, approved = true }: MemberIdCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  // broken photo (dead URL / 404) → fall back to the initials avatar so the
  // card AND its download never break
  const [photoFailed, setPhotoFailed] = useState(false)
  useEffect(() => {
    setPhotoFailed(false)
  }, [photoUrl])
  const showsPhoto = !!photoUrl && !photoFailed

  const handleDownload = async () => {
    const node = cardRef.current
    if (!node || downloading) return
    setDownloading(true)
    try {
      // imagePlaceholder: if the member photo can't be re-fetched during the
      // capture, a transparent pixel is embedded instead of throwing —
      // the download always succeeds.
      const dataUrl = await toPng(node, {
        pixelRatio: 3,
        cacheBust: false,
        imagePlaceholder:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      })
      // decode WITHOUT fetch() — fetch on a big data: URL fails on Android
      // WebView ("Failed to fetch"); plain atob works everywhere
      const blob = dataUrlToBlob(dataUrl)
      const outcome = await saveBlobToDevice(
        blob,
        `BAS-Member-ID-${cardNumber || 'card'}.png`,
        'image/png'
      )
      if (outcome === 'saved') toast({ title: 'ID card Downloads ফোল্ডারে সেভ হয়েছে ✓' })
      else if (outcome === 'shared') toast({ title: 'ID card ready — save বা share করুন ✓' })
      else toast({ title: 'ID card download হয়েছে ✓' })
    } catch (err) {
      toast({
        title: err instanceof Error && err.message ? err.message : 'Download failed — please try again',
        variant: 'destructive',
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[350px]">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        whileHover={{ scale: 1.015, transition: { duration: 0.2 } }}
        className="w-full"
      >
        <div
          ref={cardRef}
          style={{ containerType: 'inline-size' }}
          className="@container relative flex aspect-[1.586/1] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_14px_30px_-10px_rgb(30_41_59/0.35),0_5px_12px_-6px_rgb(30_41_59/0.2)] ring-1 ring-amber-300"
        >
          {/* Header band */}
          <div className="relative flex h-[31%] shrink-0 items-center gap-[2.6cqw] overflow-hidden border-b-[3px] border-amber-400 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 px-[3.4cqw]">
            <span aria-hidden className="pointer-events-none absolute -right-[8cqw] -top-[14cqw] h-[34cqw] w-[34cqw] rounded-full border border-amber-300/20" />
            <span aria-hidden className="pointer-events-none absolute -bottom-[18cqw] right-[24cqw] h-[26cqw] w-[26cqw] rounded-full border border-sky-300/15" />
            <img
              src="/logo.png"
              alt="B.A.S Sangha logo"
              className="h-[11.4cqw] w-[11.4cqw] shrink-0 rounded-full bg-white object-cover ring-2 ring-amber-300/80"
            />
            <div className="min-w-0 space-y-[0.5cqw]">
              <p className="text-[5.1cqw] font-black leading-[1.2] text-white [text-shadow:0_1px_3px_rgb(0_0_0/40%)]">ভোরের আলো সংঘ</p>
              <p className="text-[2.9cqw] font-bold uppercase leading-[1.3] tracking-[0.35em] text-amber-300">B.A.S Sangha</p>
              <p className="text-[2.3cqw] leading-[1.2] text-blue-200">Dakshin Gobindapur • Estd 2021</p>
            </div>
            <div aria-hidden className="ml-auto flex shrink-0 flex-col items-end gap-[1cqw] pr-[0.5cqw]">
              <span className="h-[1.4cqw] w-[1.4cqw] rounded-full bg-amber-300/80" />
              <span className="h-[1cqw] w-[1cqw] rounded-full bg-amber-300/45" />
            </div>
          </div>

          {/* Premium approved seal — gold stamp straddling the header/body seam */}
          {approved && (
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 12, delay: 0.3 }}
              className="absolute right-[3cqw] top-[20%] z-20 flex h-[16.5cqw] w-[16.5cqw] flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#fef9c3_0%,#fcd34d_45%,#d97706_100%)] shadow-[0_4px_12px_-2px_rgb(146_64_14/0.55)] ring-[0.8cqw] ring-white/95"
            >
              <span aria-hidden className="absolute inset-[0.9cqw] rounded-full border-[0.35cqw] border-dashed border-amber-800/45" />
              <BadgeCheck className="size-[6.2cqw] text-amber-950" strokeWidth={2.6} />
              <span className="mt-[0.4cqw] text-[2cqw] font-black uppercase leading-none tracking-[0.12em] text-amber-950">Approved</span>
            </motion.span>
          )}

          {/* Body */}
          <div className="relative flex min-h-0 flex-1 gap-[2.8cqw] px-[3cqw] py-[2.4cqw]">
            <span
              aria-hidden
              className="pointer-events-none absolute right-2 top-2 rotate-12 select-none text-[10px] font-black tracking-[0.3em] text-stone-200/70"
            >
              MEMBER
            </span>

            {showsPhoto ? (
              <img
                src={photoUrl}
                alt={name || 'Member photo'}
                onError={() => setPhotoFailed(true)}
                className="h-[30cqw] w-[24cqw] shrink-0 self-center rounded-lg bg-stone-100 object-cover ring-2 ring-amber-400/70"
              />
            ) : (
              <div className="flex h-[30cqw] w-[24cqw] shrink-0 items-center justify-center self-center rounded-lg bg-stone-100 ring-2 ring-amber-400/70">
                <User className="size-[9cqw] text-stone-300" />
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-[0.7cqw]">
              <div className="min-w-0">
                <p className="text-[2.3cqw] font-bold uppercase leading-none tracking-wider text-stone-400">Name</p>
                <p className="truncate text-[4.1cqw] font-black leading-[1.15] text-stone-900">{name || 'Member'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[2.3cqw] font-bold uppercase leading-none tracking-wider text-stone-400">Mobile</p>
                <p className="flex items-center gap-[1cqw] text-[3.5cqw] font-bold leading-[1.2] text-stone-700">
                  <Phone className="size-[3.4cqw] shrink-0 text-blue-800" />
                  <span className="truncate">{phone || '—'}</span>
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[2.3cqw] font-bold uppercase leading-none tracking-wider text-stone-400">Village / Address</p>
                <p className="flex items-start gap-[1cqw] text-[3.3cqw] font-semibold leading-[1.25] text-stone-700">
                  <MapPin className="mt-[0.2cqw] size-[3.4cqw] shrink-0 text-blue-800" />
                  <span className="line-clamp-2">{address || '—'}</span>
                </p>
              </div>
              {cardNumber ? (
                <span className="inline-flex items-stretch self-start overflow-hidden rounded-md border border-amber-300 leading-[1.2] shadow-sm">
                  <span className="inline-flex items-center gap-[1cqw] bg-amber-50 px-[2cqw] py-[0.7cqw] font-mono text-[3.4cqw] font-black text-amber-800">
                    <IdCard className="size-[3.4cqw] shrink-0" />
                    {cardNumber}
                  </span>
                  {approved && (
                    <span className="inline-flex items-center gap-[0.8cqw] bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-[1.8cqw] font-sans text-[2.7cqw] font-black uppercase tracking-wide text-amber-950">
                      <Star className="size-[3cqw] fill-amber-950" /> Premium
                    </span>
                  )}
                </span>
              ) : null}
            </div>
          </div>

          {/* Footer band */}
          <div className="flex h-[9%] shrink-0 items-center justify-between bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 px-[3.4cqw]">
            <p className="text-[2.3cqw] font-semibold leading-none text-blue-100/90">Official Member ID</p>
            {approved && (
              <span className="flex items-center gap-[0.8cqw] rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-[1.8cqw] py-[0.5cqw] text-[1.9cqw] font-black uppercase tracking-wider text-blue-950 shadow-sm">
                <Star className="size-[2.4cqw] fill-blue-950" /> Premium Member
              </span>
            )}
            <p className="text-[2.3cqw] leading-none text-amber-200/90">ভোরের আলো সংঘ</p>
          </div>

          {/* Glossy sheen */}
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
        </div>
      </motion.div>

      <div className="mt-4">
        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-5 text-base font-bold text-white shadow-lg hover:from-emerald-700 hover:to-emerald-600"
        >
          {downloading ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
          {downloading ? 'Preparing...' : 'Download ID Card'}
        </Button>
        <p className="mt-2 text-center text-[11px] text-stone-400">
          ID card টি download করে রেখে দিন — সব অনুষ্ঠানে দেখাতে পারেন
        </p>
      </div>
    </div>
  )
}
