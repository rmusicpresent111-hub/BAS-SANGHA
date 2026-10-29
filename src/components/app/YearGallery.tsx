'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, X } from 'lucide-react'
import { useCachedJson } from '@/lib/client-cache'
import type { GalleryData, GalleryPhotoDto } from '@/lib/types'
import { Loading } from './common'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

function PhotoTile({ photo, onOpen }: { photo: GalleryPhotoDto; onOpen: () => void }) {
  return (
    <Dialog open={undefined}>
      <DialogTrigger asChild onClick={onOpen}>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="group relative aspect-square w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-sm"
          aria-label={`View photo ${photo.caption || ''}`}
        >
          <Image
            src={photo.imageUrl}
            alt={photo.caption || 'Club memory'}
            fill
            sizes="(max-width: 640px) 33vw, 200px"
            className="object-cover transition-transform duration-300 group-hover:scale-110"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <p className="truncate text-[10px] font-medium text-white">{photo.caption}</p>
          </div>
        </motion.button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-2xl p-2 sm:max-w-2xl">
        <DialogTitle className="sr-only">{photo.caption || 'Club memory'}</DialogTitle>
        <div className="flex max-h-[78vh] w-full items-center justify-center overflow-hidden rounded-xl bg-stone-900">
          <Image
            src={photo.imageUrl}
            alt={photo.caption || 'Club memory'}
            width={1200}
            height={1200}
            sizes="(max-width: 640px) 92vw, 640px"
            className="h-auto max-h-[78vh] w-auto max-w-full object-contain"
            priority
          />
        </div>
        {photo.caption && <p className="py-2.5 text-center text-sm font-bold text-stone-700">{photo.caption}</p>}
      </DialogContent>
    </Dialog>
  )
}

export default function YearGallery({ compact = false }: { compact?: boolean }) {
  const { data } = useCachedJson<GalleryData>('/api/public/gallery')
  // null = user hasn't picked a year yet → show the latest one
  const [pickedYear, setPickedYear] = useState<string | null>(null)
  const year = pickedYear || data?.years[0]?.year || ''

  if (!data) return <Loading label="Loading memories..." />
  if (data.years.length === 0)
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Camera className="h-8 w-8 text-stone-300" />
        <p className="text-sm text-stone-500">No memories added yet</p>
      </div>
    )

  const current = data.years.find((y) => y.year === year)
  const photos = current ? (compact ? current.photos.slice(0, 6) : current.photos) : []

  return (
    <div>
      {/* year chips */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {data.years.map((y) => (
          <button
            key={y.year}
            onClick={() => setPickedYear(y.year)}
            className={`relative shrink-0 rounded-full px-6 py-2 text-sm font-bold transition-all ${
              year === y.year
                ? 'bg-gradient-to-r from-red-700 to-red-600 text-white shadow-lg'
                : 'bg-white text-stone-600 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50'
            }`}
          >
            {y.year}
            <span className="ml-1.5 text-[10px] font-medium opacity-70">({y.photos.length})</span>
          </button>
        ))}
      </div>

      {/* photos */}
      <AnimatePresence mode="wait">
        <motion.div
          key={year}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className={`grid grid-cols-3 gap-2 sm:grid-cols-4 ${compact ? 'max-h-96 overflow-y-auto custom-scroll pr-1' : ''}`}
        >
          {photos.map((p) => (
            <PhotoTile key={p.id} photo={p} onOpen={() => {}} />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function LightboxHint() {
  return (
    <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-stone-400">
      <X className="h-3 w-3" /> Tap a photo to view full size
    </p>
  )
}
