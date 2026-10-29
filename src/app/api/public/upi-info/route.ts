import { NextRequest, NextResponse } from 'next/server'
import { getUpiSettings, buildUpiIntent, qrDataUrlFor } from '@/lib/upi'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

/**
 * GET /api/public/upi-info?amount=&note=
 *
 * Replaces the old QR-code endpoint. Returns ONLY text payee details + a
 * UPI deep link so the client can deep-link into GPay / PhonePe / Paytm.
 * No image is served, no DB writes happen.
 *
 * Security:
 * - The UPI ID / payee name are already public (shown on the home page), so
 *   this stays public — but every input is validated server-side and the
 *   endpoint is rate limited to stop link-spam abuse.
 * - amount is forced to an integer within a sane range before it is embedded
 *   in the intent string; note is length-capped and stripped.
 */
const AMOUNT_MIN = 1
const AMOUNT_MAX = 1000000

export async function GET(req: NextRequest) {
  if (!rateLimit(`upiinfo:${clientIp(req)}`, 30, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()

  try {
    const sp = req.nextUrl.searchParams
    const amount = Math.round(Number(sp.get('amount')))
    const rawNote = String(sp.get('note') || '').replace(/[\u0000-\u001f<>]/g, '').trim()

    if (!Number.isFinite(amount) || amount < AMOUNT_MIN || amount > AMOUNT_MAX)
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })

    const note = (rawNote || 'Payment').slice(0, 40)

    const { upiId, upiName } = await getUpiSettings()
    const upiIntent = buildUpiIntent({ upiId, upiName, amount, note })
    const qrDataUrl = await qrDataUrlFor(upiIntent)

    return NextResponse.json({ upiId, upiName, amount, note, upiIntent, qrDataUrl })
  } catch (e) {
    console.error('upi-info error', e)
    return NextResponse.json({ error: 'Failed to load UPI info' }, { status: 500 })
  }
}
