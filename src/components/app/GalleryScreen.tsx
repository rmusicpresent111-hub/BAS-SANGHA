'use client'

import { Camera, Images } from 'lucide-react'
import { useApp } from '@/lib/store'
import { ScreenHeader } from './common'
import YearGallery from './YearGallery'

export default function GalleryScreen() {
  const { setView } = useApp()
  return (
    <div className="bg-club flex min-h-screen flex-col">
      <ScreenHeader title="Club Gallery" subtitle="Memories of B.A.S Sangha" onBack={() => setView('home')} accent="blue" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="mb-5 flex items-center gap-2">
          <Images className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-black text-blue-950">Year-wise Memories</h2>
        </div>
        <YearGallery />
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-stone-400">
          <Camera className="h-3.5 w-3.5" /> ছবিতে ক্লিক করলে বড় করে দেখা যাবে
        </p>
      </main>
    </div>
  )
}
