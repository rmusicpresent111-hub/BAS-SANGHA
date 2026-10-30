import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { ensureFormColumns } from '@/lib/form-migrate'
import { sanitizeExtraData } from '@/lib/extra-data'

/** Get my latest blood donation pledge. */
export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await ensureFormColumns()
    const request = await db.bloodRequest.findFirst({
      where: { userId: session.uid },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ request: request || null })
  } catch (e) {
    console.error('blood request get error', e)
    return NextResponse.json({ error: 'Failed to load request' }, { status: 500 })
  }
}

/** Pledge to donate blood. */
export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`breq:${session.uid}:${clientIp(req)}`, 8, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many attempts. Please try again after 10 minutes.' }, { status: 429 })
  try {
    await ensureFormColumns()
    const body = await req.json()
    // audit: hard length caps on free-text fields (DB abuse / spam control)
    const name = String(body.name || '').trim().slice(0, 80)
    const address = String(body.address || '').trim().slice(0, 120)
    const phone = String(body.phone || '').trim().slice(0, 15)
    const extraData = sanitizeExtraData(body.extraData)

    if (!name || !address || !phone)
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    if (!/^\d{10}$/.test(phone))
      return NextResponse.json({ error: 'Please enter a valid 10-digit phone number' }, { status: 400 })

    const existing = await db.bloodRequest.findFirst({
      where: { userId: session.uid, status: { in: ['WAITING', 'APPROVED'] } },
      orderBy: { createdAt: 'desc' },
    })
    if (existing)
      return NextResponse.json(
        { error: 'You have already pledged for this camp', existing },
        { status: 409 }
      )

    const request = await db.bloodRequest.create({
      data: { userId: session.uid, name, address, phone, extraData, status: 'WAITING' },
    })
    return NextResponse.json({ request })
  } catch (e) {
    console.error('blood request error', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
