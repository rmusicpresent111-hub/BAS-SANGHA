import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

function deny() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const members = await db.committeeMember.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ members })
}

export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  try {
    const b = await req.json()
    const name = String(b.name || '').trim()
    const role = String(b.role || 'Member').trim()
    const phone = String(b.phone || '').trim()
    const photoUrl = String(b.photoUrl || '').trim()
    const sortOrder = Number(b.sortOrder || 0)
    if (!name || !photoUrl || !phone)
      return NextResponse.json({ error: 'Name, phone and photo are required' }, { status: 400 })
    const member = await db.committeeMember.create({
      data: { name, role, phone, photoUrl, sortOrder, active: b.active !== false },
    })
    return NextResponse.json({ member })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
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
    if (b.name !== undefined) data.name = String(b.name).trim()
    if (b.role !== undefined) data.role = String(b.role).trim()
    if (b.phone !== undefined) data.phone = String(b.phone).trim()
    if (b.photoUrl !== undefined) data.photoUrl = String(b.photoUrl).trim()
    if (b.sortOrder !== undefined) data.sortOrder = Number(b.sortOrder)
    if (b.active !== undefined) data.active = Boolean(b.active)
    const member = await db.committeeMember.update({ where: { id }, data })
    return NextResponse.json({ member })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await db.committeeMember.delete({ where: { id } })
  } catch {
    // P2025 (already gone) — treat as idempotent success so stale UI retries don't 500
  }
  return NextResponse.json({ ok: true })
}
