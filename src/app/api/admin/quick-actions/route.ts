import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

function deny() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const actions = await db.quickAction.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ actions })
}

export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  try {
    const b = await req.json()
    const label = String(b.label || '').trim()
    if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 400 })
    const action = await db.quickAction.create({
      data: {
        label,
        icon: String(b.icon || 'landmark'),
        color: String(b.color || 'violet'),
        link: String(b.link || 'home'),
        sortOrder: Number(b.sortOrder || 0),
        active: b.active !== false,
      },
    })
    return NextResponse.json({ action })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create quick action' }, { status: 500 })
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
    if (b.label !== undefined) data.label = String(b.label).trim()
    if (b.icon !== undefined) data.icon = String(b.icon)
    if (b.color !== undefined) data.color = String(b.color)
    if (b.link !== undefined) data.link = String(b.link)
    if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder)
    if (b.active !== undefined) data.active = Boolean(b.active)
    const action = await db.quickAction.update({ where: { id }, data })
    return NextResponse.json({ action })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update quick action' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await db.quickAction.delete({ where: { id } })
  } catch {
    // P2025 (already gone) — treat as idempotent success so stale UI retries don't 500
  }
  return NextResponse.json({ ok: true })
}
