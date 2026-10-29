import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

function deny() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/** Public list of notices is served by /api/public/home; this route is admin CRUD. */
export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const notices = await db.notice.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ notices })
}

export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  try {
    const b = await req.json()
    const title = String(b.title || '').trim()
    const body = String(b.body || '').trim()
    if (!title || !body)
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
    const notice = await db.notice.create({ data: { title, body, active: b.active !== false } })
    return NextResponse.json({ notice })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to create notice' }, { status: 500 })
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
    if (b.body !== undefined) data.body = String(b.body).trim()
    if (b.active !== undefined) data.active = Boolean(b.active)
    const notice = await db.notice.update({ where: { id }, data })
    return NextResponse.json({ notice })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update notice' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await db.notice.delete({ where: { id } })
  } catch {
    // P2025 (already gone) — treat as idempotent success so stale UI retries don't 500
  }
  return NextResponse.json({ ok: true })
}
