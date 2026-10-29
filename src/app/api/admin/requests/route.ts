import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

function deny() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

type Tab = 'member' | 'tournament' | 'drawing' | 'blood'

/** Unique membership ID in the form B-A-S-XXXXXX (e.g. B-A-S-982609). */
async function generateCardNumber(): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const num = String(Math.floor(100000 + Math.random() * 900000)) // 6 digits
    const candidate = `B-A-S-${num}`
    const exists = await db.memberRequest.findFirst({ where: { cardNumber: candidate } })
    if (!exists) return candidate
  }
  return `B-A-S-${Date.now().toString().slice(-6)}` // practically unreachable fallback
}

/** GET /api/admin/requests?tab=member|tournament|drawing|blood */
export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const tab = (req.nextUrl.searchParams.get('tab') || 'member') as Tab
  try {
    if (tab === 'member') {
      const requests = await db.memberRequest.findMany({ orderBy: { createdAt: 'desc' } })
      const users = await db.user.findMany({ where: { id: { in: requests.map((r) => r.userId) } } })
      const umap = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]))
      return NextResponse.json({
        requests: requests.map((r) => ({ ...r, user: umap.get(r.userId) || null })),
      })
    }
    if (tab === 'tournament') {
      const requests = await db.tournamentRequest.findMany({ orderBy: { createdAt: 'desc' } })
      const users = await db.user.findMany({ where: { id: { in: requests.map((r) => r.userId) } } })
      const umap = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]))
      return NextResponse.json({
        requests: requests.map((r) => ({ ...r, user: umap.get(r.userId) || null })),
      })
    }
    if (tab === 'drawing') {
      const requests = await db.drawingRequest.findMany({ orderBy: { createdAt: 'desc' } })
      const users = await db.user.findMany({ where: { id: { in: requests.map((r) => r.userId) } } })
      const umap = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]))
      return NextResponse.json({
        requests: requests.map((r) => ({ ...r, user: umap.get(r.userId) || null })),
      })
    }
    const requests = await db.bloodRequest.findMany({ orderBy: { createdAt: 'desc' } })
    const users = await db.user.findMany({ where: { id: { in: requests.map((r) => r.userId) } } })
    const umap = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]))
    return NextResponse.json({
      requests: requests.map((r) => ({ ...r, user: umap.get(r.userId) || null })),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to load requests' }, { status: 500 })
  }
}

/** PUT { tab, id, status, note } -> approve/reject/waiting */
export async function PUT(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  try {
    const b = await req.json()
    const tab = String(b.tab || '') as Tab
    const id = String(b.id || '')
    const status = String(b.status || '')
    const note = b.note != null ? String(b.note).slice(0, 300) : undefined
    if (!['member', 'tournament', 'drawing', 'blood'].includes(tab))
      return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
    if (!['WAITING', 'APPROVED', 'REJECTED'].includes(status))
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

    if (tab === 'member') {
      const data: { status: string; note?: string; cardNumber?: string } = { status }
      if (note !== undefined) data.note = note
      if (status === 'APPROVED') {
        const current = await db.memberRequest.findUnique({ where: { id } })
        if (current && !current.cardNumber) data.cardNumber = await generateCardNumber()
      }
      const r = await db.memberRequest.update({ where: { id }, data })
      return NextResponse.json({ request: r })
    }
    if (tab === 'tournament') {
      const r = await db.tournamentRequest.update({ where: { id }, data: { status, ...(note !== undefined ? { note } : {}) } })
      return NextResponse.json({ request: r })
    }
    if (tab === 'drawing') {
      const r = await db.drawingRequest.update({ where: { id }, data: { status, ...(note !== undefined ? { note } : {}) } })
      return NextResponse.json({ request: r })
    }
    const r = await db.bloodRequest.update({ where: { id }, data: { status, ...(note !== undefined ? { note } : {}) } })
    return NextResponse.json({ request: r })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
}

/** DELETE ?tab=member|tournament|drawing|blood&id= — ADMIN only, permanently remove one request. */
export async function DELETE(req: NextRequest) {
  const session = getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const tab = (req.nextUrl.searchParams.get('tab') || '') as Tab
  const id = req.nextUrl.searchParams.get('id')
  if (!['member', 'tournament', 'drawing', 'blood'].includes(tab))
    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    if (tab === 'member') await db.memberRequest.delete({ where: { id } })
    else if (tab === 'tournament') await db.tournamentRequest.delete({ where: { id } })
    else if (tab === 'drawing') await db.drawingRequest.delete({ where: { id } })
    else await db.bloodRequest.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }
}
