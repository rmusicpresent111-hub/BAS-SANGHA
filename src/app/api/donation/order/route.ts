import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { getUpiSettings, buildUpiIntent, qrDataUrlFor } from '@/lib/upi'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

/**
 * Security rules for donations:
 * - Auth required (Bearer token or cookie).
 * - Amount is validated SERVER-side: integer, ₹10 – ₹1,00,000. The client
 *   can never inject an arbitrary amount into a payment order.
 * - orderId is generated server-side (crypto random) and unique.
 * - The UPI intent is built server-side; the order reference travels in the
 *   `tn` note ("Donation <orderId>") shown inside the payer's UPI app.
 * - Rate limited per user+IP to stop order spam.
 */

const AMOUNT_MIN = 10
const AMOUNT_MAX = 100000

function makeOrderId(): string {
  // 10 chars of cryptographically random base32-ish text
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(10)
  let s = ''
  for (const b of bytes) s += alphabet[b % alphabet.length]
  return `BAS-D-${s}`
}

/** POST { amount, phone? } -> creates a PENDING donation order + upiIntent */
export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`dord:${session.uid}:${clientIp(req)}`, 15, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many attempts. Please try again after 10 minutes.' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()

  try {
    const body = await req.json().catch(() => ({}))
    const amount = Math.round(Number(body.amount))
    if (!Number.isFinite(amount) || amount < AMOUNT_MIN || amount > AMOUNT_MAX)
      return NextResponse.json(
        { error: `Amount must be between ₹${AMOUNT_MIN} and ₹${AMOUNT_MAX}` },
        { status: 400 }
      )

    // optional payer phone (for the receipt); validated strictly
    let payerPhone = String(body.phone || '').replace(/\D/g, '').slice(-10)
    if (payerPhone && !/^\d{10}$/.test(payerPhone)) payerPhone = ''

    // prefill payer phone from the member-join record when available
    if (!payerPhone) {
      const m = await db.memberRequest.findFirst({
        where: { userId: session.uid },
        orderBy: { createdAt: 'desc' },
        select: { phone: true },
      })
      if (m?.phone) payerPhone = m.phone
    }

    const orderId = makeOrderId()
    const donation = await db.donation.create({
      data: {
        orderId,
        userId: session.uid,
        amount,
        payerName: session.name || 'Donor',
        payerPhone,
        status: 'PENDING',
      },
    })

    const { upiId, upiName } = await getUpiSettings()
    const upiIntent = buildUpiIntent({
      upiId,
      upiName,
      amount,
      note: `Donation ${orderId}`,
    })
    const qrDataUrl = await qrDataUrlFor(upiIntent)

    return NextResponse.json({
      donation: {
        id: donation.id,
        orderId,
        amount,
        status: donation.status,
        payerName: donation.payerName,
        payerPhone: donation.payerPhone,
        createdAt: donation.createdAt,
      },
      upi: { upiId, upiName, upiIntent, qrDataUrl },
    })
  } catch (e) {
    console.error('donation order error', e)
    return NextResponse.json({ error: 'Could not create the donation order. Please try again.' }, { status: 500 })
  }
}
