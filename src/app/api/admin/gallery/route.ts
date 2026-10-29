import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

function deny() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const photos = await db.galleryPhoto.findMany({ orderBy: [{ year: 'desc' }, { createdAt: 'desc' }] })
  return NextResponse.json({ photos })
}

export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  try {
    const b = await req.json()
    const year = String(b.year || '').trim()
    const caption = b.caption ? String(b.caption).trim() : null
    const imageUrl = String(b.imageUrl || '').trim()
    if (!/^\d{4}$/.test(year)) return NextResponse.json({ error: 'Valid year required (e.g. 2023)' }, { status: 400 })
    if (!imageUrl) return NextResponse.json({ error: 'Photo is required' }, { status: 400 })
    const photo = await db.galleryPhoto.create({ data: { year, caption, imageUrl } })
    return NextResponse.json({ photo })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to add photo' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await db.galleryPhoto.delete({ where: { id } })
  } catch {
    // P2025 (already gone) — treat as idempotent success so stale UI retries don't 500
  }
  return NextResponse.json({ ok: true })
}
