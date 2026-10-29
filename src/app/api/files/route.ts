import { NextRequest, NextResponse } from 'next/server'
import { safeReadUpload } from '@/lib/upload'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

/** Serves uploaded files by name: /api/files?name=xxx.png */
export async function GET(req: NextRequest) {
  // audit: light throttle so uploads can't be mass-scraped/hammered
  if (!rateLimit(`files:${clientIp(req)}`, 600, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()

  const name = req.nextUrl.searchParams.get('name') || ''
  const file = await safeReadUpload(name)
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  return new NextResponse(new Uint8Array(file.buf), {
    headers: {
      'Content-Type': file.type,
      // names are unique (timestamp + random), so content never changes
      'Cache-Control': 'public, max-age=31536000, immutable',
      // served strictly as the whitelisted extension type; never interpret as scripts
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
