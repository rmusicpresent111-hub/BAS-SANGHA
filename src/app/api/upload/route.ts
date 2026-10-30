import { NextRequest, NextResponse } from 'next/server'
import { saveUpload } from '@/lib/upload'
import { getUser } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

/**
 * Admin image/document upload.
 * POST /api/upload  (multipart/form-data, field: "file")
 * -> { url: "/api/files?name=<generated-name>" }
 *
 * Security: ADMIN role required, per-IP rate limit, 8 MB cap, extension
 * whitelist + magic-byte content validation (see src/lib/upload.ts).
 */
export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!rateLimit(`upload:${clientIp(req)}`, 30, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!file || typeof file === 'string')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const name = await saveUpload(file as File)
    if (!name)
      return NextResponse.json(
        { error: 'Invalid file (allowed: png/jpg/jpeg/webp/gif/pdf, max 8 MB, content must match type)' },
        { status: 400 },
      )

    return NextResponse.json({ url: `/api/files?name=${name}` })
  } catch (e) {
    console.error('upload failed:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
