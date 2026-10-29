import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { saveUpload } from '@/lib/upload'
import { rateLimit, clientIp } from '@/lib/rate-limit'

/** Get my latest drawing competition entry. */
export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
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

/** Submit drawing competition entry (multipart with document). */
export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`dreq:${session.uid}:${clientIp(req)}`, 8, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many attempts. Please try again after 10 minutes.' }, { status: 429 })
  try {
    const form = await req.formData()
    // audit: hard length caps on free-text fields (DB abuse / spam control)
    const name = String(form.get('name') || '').trim().slice(0, 80)
    const fatherName = String(form.get('fatherName') || '').trim().slice(0, 80)
    const className = String(form.get('className') || '').trim().slice(0, 20)
    const schoolName = String(form.get('schoolName') || '').trim().slice(0, 120)
    const doc = form.get('doc')

    if (!name || !fatherName || !className || !schoolName)
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })

    const existing = await db.drawingRequest.findFirst({
      where: { userId: session.uid, status: { in: ['WAITING', 'APPROVED'] } },
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

    const request = await db.drawingRequest.create({
      data: { userId: session.uid, name, fatherName, className, schoolName, docUrl, status: 'WAITING' },
    })
    return NextResponse.json({ request })
  } catch (e) {
    console.error('drawing request error', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
