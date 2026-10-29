'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react'
import type { BannerDto } from '@/lib/types'

const SLIDE_MS = 5_000 // auto slide every 5 seconds

export default function HeroBanner({ banners }: { banners: BannerDto[] }) {
  const [index, setIndex] = useState(0)
  const n = banners.length

  const next = useCallback(() => setIndex((i) => (i + 1) % n), [n])
  const prev = useCallback(() => setIndex((i) => (i - 1 + n) % n), [n])

  useEffect(() => {
    if (n <= 1) return
    const t = setInterval(next, SLIDE_MS)
    return () => clearInterval(t)
  }, [next, n, index])

  if (n === 0) return null
  const banner = banners[Math.min(index, n - 1)]

  return (
    <section aria-label="Club event banners" className="relative mx-3 mt-4 h-36 overflow-hidden rounded-2xl shadow-lg shadow-blue-900/10 sm:h-48 md:h-56">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={banner.id}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {banner.objectFit === 'contain' ? (
            <>
              {/* blurred backdrop + full artwork contained */}
              <Image
                src={banner.imageUrl}
                alt=""
                fill
                aria-hidden
                sizes="100vw"
                className="scale-125 object-cover blur-2xl brightness-[0.8]"
              />
              <Image
                src={banner.imageUrl}
                alt={banner.title || 'Club event banner'}
                fill
                priority={index === 0}
                sizes="100vw"
                className="object-contain p-1"
              />
            </>
          ) : (
            <Image src={banner.imageUrl} alt={banner.title || 'Club event banner'} fill priority={index === 0} sizes="100vw" className="object-cover" />
          )}
          {banner.title ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3.5 sm:p-5">
                <motion.h2
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.6 }}
                  className="bg-gradient-to-b from-white via-amber-50 to-amber-300 bg-clip-text text-lg font-black italic text-transparent drop-shadow-md sm:text-2xl"
                >
                  {banner.title}
                </motion.h2>
                {banner.subtitle && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="mt-0.5 text-[11px] font-medium text-white/90 sm:text-sm"
                  >
                    {banner.subtitle}
                  </motion.p>
                )}
              </div>
            </>
          ) : null}
        </motion.div>
      </AnimatePresence>

      {/* badge pill (top-left) */}
      {banner.badge && (
        <span className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-3 py-1.5 text-[11px] font-black text-amber-950 shadow-md">
          <Trophy className="h-3.5 w-3.5" /> {banner.badge}
        </span>
      )}

      {/* arrows */}
      {n > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Previous banner"
            className="absolute left-2.5 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/20 text-white backdrop-blur transition hover:bg-white/35 active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            aria-label="Next banner"
            className="absolute right-2.5 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/20 text-white backdrop-blur transition hover:bg-white/35 active:scale-95"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* dots */}
      <div className="absolute bottom-2.5 right-4 z-10 flex gap-1.5">
        {banners.map((b, i) => (
          <button
            key={b.id}
            onClick={() => setIndex(i)}
            aria-label={`Go to banner ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-amber-400' : 'w-2 bg-white/60 hover:bg-white'}`}
          />
        ))}
      </div>
    </section>
  )
}
