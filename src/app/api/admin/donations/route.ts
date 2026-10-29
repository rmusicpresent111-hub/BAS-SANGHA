import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

function deny() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/** GET /api/admin/donations — ADMIN only, all donations with donor account info. */
export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  try {
    const donations = await db.donation.findMany({ orderBy: { createdAt: 'desc' } })
    const users = await db.user.findMany({
      where: { id: { in: donations.map((d) => d.userId) } },
      select: { id: true, name: true, email: true },
    })
    const umap = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]))
    return NextResponse.json({
      donations: donations.map((d) => ({ ...d, user: umap.get(d.userId) || null })),
    })
  } catch (e) {
    console.error('admin donations get error', e)
    return NextResponse.json({ error: 'Failed to load donations' }, { status: 500 })
  }
}

/** PUT { id, status: VERIFIED|REJECTED|SUBMITTED, note? } — ADMIN only decision. */
export async function PUT(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  try {
    const b = await req.json()
    const id = String(b.id || '')
    const status = String(b.status || '')
    const note = b.note != null ? String(b.note).slice(0, 300) : undefined
    if (!['SUBMITTED', 'VERIFIED', 'REJECTED'].includes(status))
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const donation = await db.donation.update({
      where: { id },
      data: { status, ...(note !== undefined ? { note } : {}) },
    })
    return NextResponse.json({ donation })
  } catch (e) {
    console.error('admin donations put error', e)
    return NextResponse.json({ error: 'Failed to update donation' }, { status: 500 })
  }
}

/** DELETE ?id= — ADMIN only, permanently remove one donation entry. */
export async function DELETE(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await db.donation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
  }
}
