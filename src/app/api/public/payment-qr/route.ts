import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { getUpiSettings, buildUpiIntent } from '@/lib/upi'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

/**
 * Official club payment QR.
 * Serves the club's own JioFinance UPI QR image (ARINDAM DAS · 7908344580@jio)
 * instead of generating one — the image lives at public/images/upi-qr.png.
 * Also returns a server-built upi:// intent so the client can deep-link
 * straight into GPay / PhonePe / Paytm on mobile.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`pqr:${clientIp(req)}`, 30, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()
  try {
    const sp = req.nextUrl.searchParams
    // NaN guard — ?amount=abc must fall back to 1, never emit am=NaN
    const parsed = Number(sp.get('amount') || 1)
    const amount = Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1
    // strip control chars from the note (UPI intent hygiene, mirrors upi-info)
    const note = (sp.get('note') || 'B.A.S Sangha Payment')
      .replace(/[\u0000-\u001f<>]/g, '')
      .slice(0, 40)

    // payee text details come from admin settings (kept in sync with the QR)
    const { upiId, upiName } = await getUpiSettings()
    const upiIntent = buildUpiIntent({ upiId, upiName, amount, note })

    const file = await readFile(path.join(process.cwd(), 'public', 'images', 'upi-qr.png'))
    const dataUrl = `data:image/png;base64,${file.toString('base64')}`

    return NextResponse.json({ dataUrl, upiId, upiName, amount, note, upiIntent })
  } catch (e) {
    console.error('qr error', e)
    return NextResponse.json({ error: 'Failed to load QR' }, { status: 500 })
  }
}
