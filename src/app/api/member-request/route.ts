import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { saveUpload } from '@/lib/upload'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'
import { findUtrConflict, UTR_TAKEN_MSG } from '@/lib/utr'
import { ensurePaymentMethodColumns } from '@/lib/drawing-migrate'

const PHOTO_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const PHOTO_EXT = ['png', 'jpg', 'jpeg', 'webp']

/** Get my latest member join request. */
export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const request = await db.memberRequest.findFirst({
      where: { userId: session.uid },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ request: request || null })
  } catch (e) {
    console.error('member request get error', e)
    return NextResponse.json({ error: 'Failed to load request' }, { status: 500 })
  }
}

/** Submit member join request (multipart): name, village, phone, photo + UTR number (QR pay)
 *  OR paymentMethod=CASH (no UTR — admin verifies the cash by hand before approving). */
export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // rate limit: max 8 submissions per 10 min (per user + IP) — blocks UTR brute-forcing
  if (!rateLimit(`mreq:${session.uid}:${clientIp(req)}`, 8, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many attempts. Please try again after 10 minutes.' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()
  try {
    await ensurePaymentMethodColumns()
    const fd = await req.formData()
    // audit: hard length caps on free-text fields (DB abuse / spam control)
    const str = (k: string, max = 120) => String(fd.get(k) || '').trim().slice(0, max)
    const name = str('name', 80)
    const address = str('address') // village name
    const phone = str('phone', 15)
    const age = str('age', 3)
    const fatherName = str('fatherName', 80)
    const email = str('email', 120)
    const paymentMethod = str('paymentMethod', 10).toUpperCase() === 'CASH' ? 'CASH' : 'QR'
    const utr = paymentMethod === 'CASH' ? '' : str('utr', 30).toUpperCase()

    if (!name || !address || !phone)
      return NextResponse.json({ error: 'Name, village and phone are required' }, { status: 400 })
    if (!/^\d{10}$/.test(phone))
      return NextResponse.json({ error: 'Please enter a valid 10-digit phone number' }, { status: 400 })
    if (paymentMethod !== 'CASH' && !/^[A-Za-z0-9]{10,22}$/.test(utr))
      return NextResponse.json({ error: 'Please enter a valid UTR number (10-22 characters)' }, { status: 400 })

    const existing = await db.memberRequest.findFirst({
      where: { userId: session.uid, status: { in: ['WAITING', 'APPROVED'] } },
      orderBy: { createdAt: 'desc' },
    })
    if (existing)
      return NextResponse.json(
        { error: 'You already have a request under review', existing },
        { status: 409 }
      )

    // block UTR reuse: the same payment proof must never be accepted twice
    // (checked across donations, member join AND tournament submissions).
    // Cash has no UTR — skipped entirely.
    if (paymentMethod !== 'CASH') {
      const utrReuse = await db.memberRequest.findFirst({
        where: { utr, status: { in: ['WAITING', 'APPROVED'] } },
        select: { id: true, userId: true },
      })
      if (utrReuse && utrReuse.userId !== session.uid)
        return NextResponse.json({ error: UTR_TAKEN_MSG }, { status: 409 })
      if (!utrReuse && (await findUtrConflict(utr)))
        return NextResponse.json({ error: UTR_TAKEN_MSG }, { status: 409 })
    }

    // photo — saved ONLY after every validation passes (no orphan files on 409/400)
    let photoUrl: string | null = null
    const photo = fd.get('photo')
    if (photo && typeof photo !== 'string') {
      const ext = (photo.name.split('.').pop() || '').toLowerCase()
      if (!PHOTO_EXT.includes(ext))
        return NextResponse.json({ error: 'Photo must be a JPG / PNG / WebP image' }, { status: 400 })
      if (photo.size > PHOTO_MAX_BYTES)
        return NextResponse.json({ error: 'Photo is too large — maximum 5 MB allowed' }, { status: 400 })
      const saved = await saveUpload(photo)
      if (!saved) return NextResponse.json({ error: 'Photo upload failed — please try again' }, { status: 400 })
      photoUrl = `/api/files?name=${saved}`
    }

    const feeSetting = await db.setting.findUnique({ where: { key: 'memberFee' } })
    const fee = Number(feeSetting?.value || 1500)

    // Re-check UTR + existing inside the transaction so two rapid submits
    // cannot both slip through the pre-check (SQLite serializes writes).
    const request = await db.$transaction(async (tx) => {
      const dup = await tx.memberRequest.findFirst({
        where: { userId: session.uid, status: { in: ['WAITING', 'APPROVED'] } },
        select: { id: true },
      })
      if (dup) return null
      if (paymentMethod !== 'CASH' && (await findUtrConflict(utr, tx))) return null
      return tx.memberRequest.create({
        data: {
          userId: session.uid,
          name,
          age,
          fatherName,
          address,
          phone,
          email,
          photoUrl,
          fee,
          utr,
          paymentMethod,
          status: 'WAITING',
        },
      })
    })
    if (!request)
      return NextResponse.json({ error: UTR_TAKEN_MSG }, { status: 409 })
    return NextResponse.json({ request })
  } catch (e) {
    console.error('member request error', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
