import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

function deny() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

const TYPES = ['CRICKET', 'FOOTBALL', 'DRAWING', 'BLOOD']

export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const events = await db.event.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ events })
}

/** Create or update an event config by type. */
export async function PUT(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  try {
    const b = await req.json()
    const type = String(b.type || '')
    if (!TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    const data: Record<string, unknown> = {}
    if (b.title !== undefined) data.title = String(b.title).trim()
    if (b.bannerUrl !== undefined) data.bannerUrl = String(b.bannerUrl).trim()
    if (b.description !== undefined) data.description = b.description ? String(b.description) : null
    if (b.eventDate !== undefined) data.eventDate = b.eventDate ? String(b.eventDate) : null
    if (b.venue !== undefined) data.venue = b.venue ? String(b.venue) : null
    if (b.fee !== undefined) data.fee = Math.max(0, Number(b.fee) || 0)
    if (b.active !== undefined) data.active = Boolean(b.active)
    const event = await db.event.upsert({
      where: { type },
      update: data,
      create: { type, title: String(b.title || type), bannerUrl: String(b.bannerUrl || ''), sortOrder: 0, ...data },
    })
    return NextResponse.json({ event })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}
