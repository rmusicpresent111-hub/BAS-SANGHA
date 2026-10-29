/**
 * FCM push-token registry.
 *
 * POST   — register/refresh this browser's Firebase token (open endpoint,
 *          rate-limited; links to the logged-in user when a session exists)
 * DELETE — remove a token (user disabled notifications)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

function cleanToken(v: unknown): string | null {
  if (typeof v !== 'string') return null
  // strip whitespace/newlines that some copy-paste flows introduce
  const t = v.replace(/[\s\u0000-\u001f\u007f]/g, '')
  if (t.length < 20 || t.length > 4096) return null
  return t
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`pushreg:${clientIp(req)}`, 60, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()

  const session = await getUser(req) // optional — anonymous devices may register too
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const token = cleanToken(body.token)
    if (!token)
      return NextResponse.json({ error: 'Invalid Firebase token' }, { status: 400 })
    const ua = (req.headers.get('user-agent') || '').slice(0, 200)

    await db.pushToken.upsert({
      where: { token },
      update: { userId: session?.uid ?? null, userAgent: ua },
      create: { token, userId: session?.uid ?? null, platform: 'web', userAgent: ua },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('push register failed', e)
    return NextResponse.json({ error: 'Could not register token' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!rateLimit(`pushunreg:${clientIp(req)}`, 60, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const token = cleanToken(body.token)
    if (!token)
      return NextResponse.json({ error: 'Invalid Firebase token' }, { status: 400 })
    await db.pushToken.deleteMany({ where: { token } }) // idempotent
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('push unregister failed', e)
    return NextResponse.json({ error: 'Could not unregister token' }, { status: 500 })
  }
}
