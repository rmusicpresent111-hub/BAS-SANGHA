import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { saveUpload } from '@/lib/upload'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'
import { ensureDrawingColumns, ensurePaymentMethodColumns } from '@/lib/drawing-migrate'

/** Default entry fee (₹30) when the admin hasn't set a DRAWING event fee. */
const DEFAULT_FEE = 30

/** Current entry fee for the drawing competition (admin-configurable in Events tab). */
async function drawingFee(): Promise<number> {
  const ev = await db.event.findUnique({ where: { type: 'DRAWING' }, select: { fee: true } })
  return ev && ev.fee > 0 ? ev.fee : DEFAULT_FEE
}

/** Get my latest drawing competition entry. */
export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await ensureDrawingColumns()
    const request = await db.drawingRequest.findFirst({
      where: { userId: session.uid },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ request: request || null })
  } catch (e) {
    console.error('drawing request get error', e)
    return NextResponse.json({ error: 'Failed to load request' }, { status: 500 })
  }
}

/**
 * Submit drawing competition entry (multipart with document) — STEP 1.
 *
 * Flow depends on the chosen payment method:
 * - paymentMethod "QR" (default): entry is created as UNPAID (fee snapshot stored) →
 *   the user pays via UPI and submits the UTR at /api/drawing-request/pay →
 *   only then does the entry enter the admin review queue (WAITING).
 * - paymentMethod "CASH": no online payment — the entry goes straight into the
 *   admin review queue (WAITING); the admin collects the cash by hand and
 *   approves it there.
 */
export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`dreq:${session.uid}:${clientIp(req)}`, 8, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many attempts. Please try again after 10 minutes.' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()
  try {
    await ensureDrawingColumns()
    await ensurePaymentMethodColumns()
    const form = await req.formData()
    // audit: hard length caps on free-text fields (DB abuse / spam control)
    const name = String(form.get('name') || '').trim().slice(0, 80)
    const fatherName = String(form.get('fatherName') || '').trim().slice(0, 80)
    const className = String(form.get('className') || '').trim().slice(0, 20)
    const schoolName = String(form.get('schoolName') || '').trim().slice(0, 120)
    const phone = String(form.get('phone') || '').trim().slice(0, 15)
    const paymentMethod = String(form.get('paymentMethod') || 'QR').trim().slice(0, 10).toUpperCase() === 'CASH' ? 'CASH' : 'QR'
    const doc = form.get('doc')

    if (!name || !fatherName || !className || !schoolName)
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    if (!/^\d{10}$/.test(phone))
      return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 })

    const existing = await db.drawingRequest.findFirst({
      where: { userId: session.uid, status: { in: ['UNPAID', 'WAITING', 'APPROVED'] } },
      orderBy: { createdAt: 'desc' },
    })
    if (existing)
      return NextResponse.json(
        { error: 'You already have an entry under review', existing },
        { status: 409 }
      )

    let docUrl = ''
    if (doc && typeof doc !== 'string') {
      const saved = await saveUpload(doc as File)
      if (saved) docUrl = `/api/files?name=${saved}`
    }
    if (!docUrl)
      return NextResponse.json(
        { error: 'Please upload Aadhaar card or birth certificate (image/PDF, max 8MB)' },
        { status: 400 }
      )

    const fee = await drawingFee()
    const request = await db.drawingRequest.create({
      data: {
        userId: session.uid,
        name,
        fatherName,
        className,
        schoolName,
        phone,
        fee,
        docUrl,
        paymentMethod,
        // cash skips the online payment step — straight into the review queue
        status: paymentMethod === 'CASH' ? 'WAITING' : 'UNPAID',
      },
    })
    return NextResponse.json({ request })
  } catch (e) {
    console.error('drawing request error', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

/**
 * DELETE my own UNPAID entry — lets the user discard a half-finished flow and
 * fill the form again. Entries that already have a payment submitted or an
 * admin decision can never be deleted from here.
 */
export async function DELETE(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`ddel:${session.uid}:${clientIp(req)}`, 10, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many attempts. Please try again after 10 minutes.' }, { status: 429 })
  try {
    await ensureDrawingColumns()
    const entry = await db.drawingRequest.findFirst({
      where: { userId: session.uid, status: 'UNPAID' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (!entry) return NextResponse.json({ error: 'No pending unpaid entry to discard' }, { status: 404 })
    await db.drawingRequest.delete({ where: { id: entry.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('drawing request delete error', e)
    return NextResponse.json({ error: 'Failed to discard entry' }, { status: 500 })
  }
}
