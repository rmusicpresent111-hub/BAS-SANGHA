/**
 * Admin push notifications (Firebase Cloud Messaging).
 *
 * GET  — token count + whether the server can actually send (service account configured)
 * POST — send a notification to every registered device. Requires the
 *        FIREBASE_SERVICE_ACCOUNT_KEY env var; returns 501 with instructions
 *        when it is missing. Invalid/expired FCM tokens are auto-removed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getAdminMessaging, adminMessagingConfigured } from '@/lib/firebase-admin'

export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const tokens = await db.pushToken.count()
    return NextResponse.json({ tokens, configured: adminMessagingConfigured() })
  } catch (e) {
    console.error('push stats failed', e)
    return NextResponse.json({ error: 'Failed to load push stats' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!rateLimit(`pushsend:${clientIp(req)}`, 10, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests — wait a few minutes' }, { status: 429 })

  if (!adminMessagingConfigured()) {
    return NextResponse.json(
      {
        error:
          'Server is not connected to Firebase yet — paste the service-account JSON into FIREBASE_SERVICE_ACCOUNT_KEY in .env (Firebase console → Project settings → Service accounts → Generate new private key), then restart.',
      },
      { status: 501 }
    )
  }
  const messaging = getAdminMessaging()
  if (!messaging)
    return NextResponse.json({ error: 'Firebase Admin SDK unavailable' }, { status: 501 })

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : ''
    const text = typeof body.body === 'string' ? body.body.trim().slice(0, 500) : ''
    if (!title || !text)
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })

    const rows = await db.pushToken.findMany({ select: { token: true }, take: 2000 })
    if (rows.length === 0)
      return NextResponse.json({ error: 'No device registered yet' }, { status: 409 })

    const tokens = rows.map((r) => r.token)
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body: text },
      webpush: {
        notification: { icon: '/logo.png', badge: '/logo.png', tag: 'bas-push' },
        fcmOptions: { link: '/' },
      },
    })

    // cleanup dead tokens so the registry stays healthy
    const dead: string[] = []
    res.responses.forEach((r, i) => {
      if (r.success) return
      const err = r.error as { code?: string; message?: string } | undefined
      const code = String(err?.code || '')
      const msg = String(err?.message || '')
      const isDead =
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token') ||
        (code.includes('invalid-argument') && msg.includes('not a valid FCM registration token'))
      if (isDead) dead.push(tokens[i])
    })
    if (dead.length) await db.pushToken.deleteMany({ where: { token: { in: dead } } })

    return NextResponse.json({
      sent: res.successCount,
      failed: res.failureCount,
      removed: dead.length,
    })
  } catch (e) {
    console.error('push send failed', e)
    return NextResponse.json({ error: 'Push send failed — check server logs' }, { status: 500 })
  }
}
