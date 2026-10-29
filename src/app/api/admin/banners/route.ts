import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

function deny() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const banners = await db.banner.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ banners })
}

export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  try {
    const b = await req.json()
    const title = String(b.title || '').trim()
    const subtitle = b.subtitle ? String(b.subtitle).trim() : null
    const imageUrl = String(b.imageUrl || '').trim()
    if (!title || !imageUrl)
      return NextResponse.json({ error: 'Title and image are required' }, { status: 400 })
    const banner = await db.banner.create({
      data: {
        title,
        subtitle,
        badge: b.badge ? String(b.badge).trim() : null,
        imageUrl,
        objectFit: b.objectFit === 'contain' ? 'contain' : 'cover',
        sortOrder: Number(b.sortOrder || 0),
        active: b.active !== false,
      },
    })
    return NextResponse.json({ banner })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  try {
    const b = await req.json()
    const id = String(b.id || '')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const data: Record<string, unknown> = {}
    if (b.title !== undefined) data.title = String(b.title).trim()
    if (b.subtitle !== undefined) data.subtitle = b.subtitle ? String(b.subtitle).trim() : null
    if (b.badge !== undefined) data.badge = b.badge ? String(b.badge).trim() : null
    if (b.imageUrl !== undefined) data.imageUrl = String(b.imageUrl).trim()
    if (b.objectFit !== undefined) data.objectFit = b.objectFit === 'contain' ? 'contain' : 'cover'
    if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder)
    if (b.active !== undefined) data.active = Boolean(b.active)
    const banner = await db.banner.update({ where: { id }, data })
    return NextResponse.json({ banner })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await db.banner.delete({ where: { id } })
  } catch {
    // P2025 (already gone) — treat as idempotent success so stale UI retries don't 500
  }
  return NextResponse.json({ ok: true })
}
