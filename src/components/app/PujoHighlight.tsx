'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { CalendarDays, ChevronRight, HandCoins, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApp } from '@/lib/store'
import type { PujoHighlightDto } from '@/lib/types'

/** Cream "শ্রী শ্রী শ্যামা পুজা" highlight banner with Kali photo + details dialog. */
export default function PujoHighlight({ highlight }: { highlight: PujoHighlightDto | null }) {
  const { setDonationOpen } = useApp()
  const [details, setDetails] = useState(false)

  if (!highlight) return null

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        aria-label="Pujo highlight"
        className="relative mx-3 mt-5 overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-r from-orange-50 via-amber-50/80 to-rose-50 shadow-md shadow-amber-900/5"
      >
        {/* hanging diya decoration (top-right, like reference) */}
        <svg
          aria-hidden
          viewBox="0 0 44 84"
          className="pointer-events-none absolute right-3 top-0 z-10 h-16 w-8 sm:right-6 sm:h-20 sm:w-11"
        >
          <line x1="22" y1="0" x2="22" y2="30" stroke="#b45309" strokeWidth="1.6" opacity="0.8" />
          <path d="M22 22 C 20.5 18, 23.5 16, 22 12" stroke="#f59e0b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M13 34 C 13 45, 31 45, 31 34 L 28.5 30 L 15.5 30 Z" fill="#f59e0b" />
          <ellipse cx="22" cy="45" rx="9.5" ry="3.4" fill="#d97706" />
          <ellipse cx="22" cy="43.6" rx="6" ry="1.8" fill="#fbbf24" />
          <circle cx="10" cy="62" r="2.2" fill="#fb7185" opacity="0.7" />
          <circle cx="36" cy="70" r="2" fill="#f472b6" opacity="0.7" />
        </svg>
        <div className="flex items-stretch">
          {/* left photo */}
          <div className="relative w-32 shrink-0 sm:w-44">
            <Image
              src={highlight.imageUrl}
              alt={highlight.title}
              width={400}
              height={533}
              sizes="(max-width: 640px) 112px, 176px"
              className="h-full w-full object-cover"
            />
          </div>

          {/* right content */}
          <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
            {highlight.badge && (
              <span className="w-fit rounded-full bg-gradient-to-r from-rose-600 to-red-600 px-2.5 py-0.5 text-[9px] font-bold tracking-wide text-white shadow-sm sm:text-[10px]">
                {highlight.badge}
              </span>
            )}
            <h2 className="mt-1 truncate text-lg font-black text-red-700 sm:text-2xl">{highlight.title}</h2>
            {highlight.subtitle && (
              <p className="mt-0.5 truncate text-[10px] font-medium text-stone-500 sm:text-xs">{highlight.subtitle}</p>
            )}

            {/* bottom row: location | date | details button (reference layout) */}
            <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
              <div className="flex min-w-0 items-stretch gap-2 sm:gap-3">
                {highlight.location && (
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-[8px] font-semibold text-stone-400 sm:text-[9px]">
                      <MapPin className="h-3 w-3 shrink-0 text-red-500" /> স্থান
                    </p>
                    <p className="text-[10px] font-bold leading-tight text-stone-800 sm:text-xs">{highlight.location}</p>
                  </div>
                )}
                {highlight.location && highlight.dateText && <span className="w-px shrink-0 bg-stone-300" />}
                {highlight.dateText && (
                  <div className="shrink-0">
                    <p className="flex items-center gap-1 text-[8px] font-semibold text-stone-400 sm:text-[9px]">
                      <CalendarDays className="h-3 w-3 shrink-0 text-red-500" /> পুজো শুরু
                    </p>
                    <p className="whitespace-nowrap text-[10px] font-bold leading-tight text-stone-800 sm:text-xs">{highlight.dateText}</p>
                  </div>
                )}
              </div>

              <Button
                onClick={() => setDetails(true)}
                className="ml-auto shrink-0 rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-2.5 py-2 text-[9px] font-bold text-white shadow-md hover:from-red-700 hover:to-orange-600 sm:px-4 sm:text-xs"
              >
                বিস্তারিত দেখুন <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* details dialog */}
      <Dialog open={details} onOpenChange={setDetails}>
        <DialogContent className="max-w-sm rounded-3xl border-2 border-amber-200 bg-white p-0 sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>{highlight.title} — details</DialogTitle>
          </DialogHeader>
          {highlight.detailImageUrl && (
            <div className="relative w-full">
              <Image
                src={highlight.detailImageUrl}
                alt={`${highlight.title} invitation card`}
                width={1600}
                height={987}
                sizes="(max-width: 640px) 100vw, 448px"
                className="h-auto w-full rounded-t-[22px] object-cover"
              />
            </div>
          )}
          <div className="px-5 pb-5 pt-4">
            <h3 className="text-center text-lg font-black text-red-800">{highlight.title}</h3>
            {highlight.subtitle && <p className="mt-0.5 text-center text-xs font-medium text-stone-500">{highlight.subtitle}</p>}
            <div className="mt-3 flex items-center justify-center gap-4 text-xs font-semibold text-stone-700">
              {highlight.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-red-500" /> {highlight.location}
                </span>
              )}
              {highlight.dateText && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-4 w-4 text-red-500" /> {highlight.dateText}
                </span>
              )}
            </div>
            <Button
              onClick={() => {
                setDetails(false)
                setDonationOpen(true)
              }}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 py-5 text-base font-bold text-white hover:from-amber-700 hover:to-amber-600"
            >
              <HandCoins className="mr-2 h-5 w-5" /> মায়ের পুজোয় আর্থিক সাহায্য করুন
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
