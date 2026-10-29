import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'
import { findUtrConflict, UTR_TAKEN_MSG } from '@/lib/utr'
import { ensurePaymentMethodColumns } from '@/lib/drawing-migrate'

function validType(t: string) {
  return t === 'CRICKET' || t === 'FOOTBALL'
}

/** Get my latest tournament request for a type (?type=CRICKET|FOOTBALL). */
export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const type = req.nextUrl.searchParams.get('type') || 'CRICKET'
  if (!validType(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  try {
    const request = await db.tournamentRequest.findFirst({
      where: { userId: session.uid, type },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ request: request || null })
  } catch (e) {
    console.error('tournament request get error', e)
    return NextResponse.json({ error: 'Failed to load request' }, { status: 500 })
  }
}

/** Submit tournament registration — UTR number (QR pay) OR paymentMethod=CASH
 *  (no UTR — admin verifies the cash by hand before approving). */
export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`treq:${session.uid}:${clientIp(req)}`, 8, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many attempts. Please try again after 10 minutes.' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()
  try {
    await ensurePaymentMethodColumns()
    const body = await req.json()
    // audit: hard length caps on free-text fields (DB abuse / spam control)
    const type = String(body.type || '')
    const teamName = String(body.teamName || '').trim().slice(0, 80)
    const address = String(body.address || '').trim().slice(0, 120)
    const phone = String(body.phone || '').trim().slice(0, 15)
    const paymentMethod = String(body.paymentMethod || 'QR').trim().slice(0, 10).toUpperCase() === 'CASH' ? 'CASH' : 'QR'
    const utr = paymentMethod === 'CASH' ? '' : String(body.utr || '').trim().slice(0, 30).toUpperCase()

    if (!validType(type))
      return NextResponse.json({ error: 'Invalid tournament type' }, { status: 400 })
    if (!teamName || !address || !phone)
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    if (!/^\d{10}$/.test(phone))
      return NextResponse.json({ error: 'Please enter a valid 10-digit phone number' }, { status: 400 })
    if (paymentMethod !== 'CASH' && !/^[A-Za-z0-9]{10,22}$/.test(utr))
      return NextResponse.json({ error: 'Please enter a valid UTR number (10-22 characters)' }, { status: 400 })

    const existing = await db.tournamentRequest.findFirst({
      where: { userId: session.uid, type, status: { in: ['WAITING', 'APPROVED'] } },
      orderBy: { createdAt: 'desc' },
    })
    if (existing)
      return NextResponse.json(
        { error: 'Your team is already registered for this tournament', existing },
        { status: 409 }
      )

    // block UTR reuse: the same payment proof must never be accepted twice
    // (checked across donations, member join AND tournament submissions).
    // Cash has no UTR — skipped entirely.
    if (paymentMethod !== 'CASH') {
      const utrReuse = await db.tournamentRequest.findFirst({
        where: { type, utr, status: { in: ['WAITING', 'APPROVED'] } },
        select: { id: true, userId: true },
      })
      if (utrReuse && utrReuse.userId !== session.uid)
        return NextResponse.json({ error: UTR_TAKEN_MSG }, { status: 409 })
      if (await findUtrConflict(utr))
        return NextResponse.json({ error: UTR_TAKEN_MSG }, { status: 409 })
    }

    const event = await db.event.findUnique({ where: { type } })
    const fee = event?.fee ?? 500

    // Re-check UTR + existing inside the transaction so two rapid submits
    // cannot both slip through the pre-check (SQLite serializes writes).
    const request = await db.$transaction(async (tx) => {
      const dup = await tx.tournamentRequest.findFirst({
        where: { userId: session.uid, type, status: { in: ['WAITING', 'APPROVED'] } },
        select: { id: true },
      })
      if (dup) return null
      if (paymentMethod !== 'CASH' && (await findUtrConflict(utr, tx))) return null
      return tx.tournamentRequest.create({
        data: { userId: session.uid, type, teamName, address, phone, fee, utr, paymentMethod, status: 'WAITING' },
      })
    })
    if (!request)
      return NextResponse.json({ error: UTR_TAKEN_MSG }, { status: 409 })
    return NextResponse.json({ request })
  } catch (e) {
    console.error('tournament request error', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
