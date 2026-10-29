import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const photos = await db.galleryPhoto.findMany({ orderBy: [{ year: 'desc' }, { createdAt: 'desc' }] })
    const byYear = new Map<string, typeof photos>()
    for (const p of photos) {
      const arr = byYear.get(p.year) || []
      arr.push(p)
      byYear.set(p.year, arr)
    }
    const years = Array.from(byYear.entries())
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([year, ps]) => ({ year, photos: ps }))
    return NextResponse.json({ years })
  } catch (e) {
    console.error('gallery error', e)
    return NextResponse.json({ error: 'Failed to load gallery' }, { status: 500 })
  }
}
