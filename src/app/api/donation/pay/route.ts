import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'
import { findUtrConflict, UTR_TAKEN_MSG } from '@/lib/utr'

const UTR_RE = /^[A-Za-z0-9]{10,22}$/

/**
 * POST { orderId, utr } — submit the UPI transaction reference after paying.
 *
 * Security rules:
 * - Auth required; the order must belong to the caller (ownership check).
 * - Only PENDING orders accept a UTR (no double-submit, no tampering with
 *   VERIFIED/REJECTED records).
 * - UTR format: 10-22 alphanumerics (matches the other payment flows).
 * - The same UTR can never be used twice — checked across ALL donations
 *   (any user) AND member/tournament requests, so one payment proof can
 *   never validate two records.
 * - Rate limited per user+IP (blocks UTR brute-force guessing).
 */
export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`dpay:${session.uid}:${clientIp(req)}`, 10, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many attempts. Please try again after 10 minutes.' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()

  try {
    const body = await req.json().catch(() => ({}))
    const orderId = String(body.orderId || '').trim()
    const utr = String(body.utr || '').trim().toUpperCase()

    if (!orderId || orderId.length > 40)
      return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
    if (!UTR_RE.test(utr))
      return NextResponse.json({ error: 'Please enter a valid UTR number (10-22 characters)' }, { status: 400 })

    // ownership check — the order MUST belong to the caller
    const donation = await db.donation.findUnique({ where: { orderId } })
    if (!donation || donation.userId !== session.uid)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (donation.status !== 'PENDING')
      return NextResponse.json({ error: 'This order was already submitted' }, { status: 409 })

    // Atomic submit: UTR-conflict check + status-guarded write run inside ONE
    // transaction (SQLite serializes transactions), so two concurrent submits
    // with the same UTR can never both pass. updateMany with the PENDING
    // predicate also makes double-submit impossible.
    const submitted = await db.$transaction(async (tx) => {
      if (await findUtrConflict(utr, tx)) return null
      const r = await tx.donation.updateMany({
        where: { id: donation.id, status: 'PENDING' },
        data: { utr, status: 'SUBMITTED' },
      })
      return r.count === 1
    })

    if (!submitted)
      return NextResponse.json({ error: UTR_TAKEN_MSG }, { status: 409 })

    const updated = await db.donation.findUnique({ where: { id: donation.id } })
    return NextResponse.json({ donation: updated })
  } catch (e) {
    console.error('donation pay error', e)
    return NextResponse.json({ error: 'Could not submit the payment. Please try again.' }, { status: 500 })
  }
}
