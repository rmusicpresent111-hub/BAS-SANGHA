import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'
import { findUtrConflict, UTR_TAKEN_MSG } from '@/lib/utr'
import { ensureDrawingColumns } from '@/lib/drawing-migrate'
import { ensureFormColumns } from '@/lib/form-migrate'

const UTR_RE = /^[A-Za-z0-9]{10,22}$/

/**
 * POST { utr } — STEP 2 of the drawing entry flow: submit the UPI transaction
 * reference after paying the entry fee.
 *
 * Security rules:
 * - Auth required; the UNPAID entry must belong to the caller.
 * - Only UNPAID entries accept a UTR (payment is a one-way door).
 * - UTR format: 10-22 alphanumerics, stored uppercase.
 * - The same UTR can never be used twice — checked across ALL flows
 *   (donations / member / tournament / drawing) inside one transaction.
 */
export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`dpay:${session.uid}:${clientIp(req)}`, 10, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many attempts. Please try again after 10 minutes.' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()

  try {
    await ensureDrawingColumns()
    await ensureFormColumns()
    const body = await req.json().catch(() => ({}))
    const utr = String(body.utr || '').trim().toUpperCase()

    if (!UTR_RE.test(utr))
      return NextResponse.json({ error: 'Please enter a valid UTR number (10-22 characters)' }, { status: 400 })

    const entry = await db.drawingRequest.findFirst({
      where: { userId: session.uid, status: 'UNPAID' },
      orderBy: { createdAt: 'desc' },
    })
    if (!entry)
      return NextResponse.json({ error: 'No unpaid entry found — please submit the form first' }, { status: 404 })

    // Atomic submit: UTR-conflict check + status-guarded write run inside ONE
    // transaction (SQLite serializes transactions), so two concurrent submits
    // with the same UTR can never both pass.
    const submitted = await db.$transaction(async (tx) => {
      if (await findUtrConflict(utr, tx)) return null
      const r = await tx.drawingRequest.updateMany({
        where: { id: entry.id, status: 'UNPAID' },
        data: { utr, status: 'WAITING' },
      })
      return r.count === 1
    })

    if (!submitted)
      return NextResponse.json({ error: UTR_TAKEN_MSG }, { status: 409 })

    const updated = await db.drawingRequest.findUnique({ where: { id: entry.id } })
    return NextResponse.json({ request: updated })
  } catch (e) {
    console.error('drawing pay error', e)
    return NextResponse.json({ error: 'Could not submit the payment. Please try again.' }, { status: 500 })
  }
}
