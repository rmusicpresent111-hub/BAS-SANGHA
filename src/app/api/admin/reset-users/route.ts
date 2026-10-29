import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

/**
 * POST /api/admin/reset-users — permanently delete every registered user
 * account and everything tied to them:
 *   • users (role != ADMIN)
 *   • donations, member/tournament/drawing/blood requests
 *   • push notification tokens, revoked-token bookkeeping rows
 *
 * ADMIN session required (same as every other admin route).
 * Safety: the body must contain { "confirm": true }.
 *
 * The caller's ADMIN account (every ADMIN-role account, in fact) is always
 * kept — otherwise nobody could ever reach this admin panel again, because
 * promoting a fresh account to ADMIN would require direct DB access.
 * Content (banners / committee / notices / events / gallery / settings /
 * uploaded files) is intentionally NOT touched — only people + their
 * submissions are wiped, giving the club a clean member list.
 */
export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!rateLimit(`reset-users:${clientIp(req)}`, 2, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()

  let confirm = false
  try {
    const body = await req.json()
    confirm = body?.confirm === true
  } catch {
    // no/invalid body → treated as missing confirmation below
  }
  if (!confirm) return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })

  try {
    const counts: Record<string, number> = {}

    // user-linked data first (all of it is test/junk once the users are gone)
    counts.pushToken = (await db.pushToken.deleteMany({})).count
    counts.donation = (await db.donation.deleteMany({})).count
    counts.bloodRequest = (await db.bloodRequest.deleteMany({})).count
    counts.drawingRequest = (await db.drawingRequest.deleteMany({})).count
    counts.tournamentRequest = (await db.tournamentRequest.deleteMany({})).count
    counts.memberRequest = (await db.memberRequest.deleteMany({})).count
    // bookkeeping: old revocation rows are meaningless once users are gone
    counts.revokedToken = (await db.revokedToken.deleteMany({})).count

    const users = await db.user.deleteMany({ where: { role: { not: 'ADMIN' } } })
    counts.user = users.count

    return NextResponse.json({
      ok: true,
      deleted: counts,
      message: `${counts.user} জন user মুছে ফেলা হয়েছে ✓ — আপনার admin account অটুট আছে।`,
    })
  } catch (e) {
    console.error('reset-users failed:', e)
    return NextResponse.json({ error: 'Reset failed — আবার চেষ্টা করুন।' }, { status: 500 })
  }
}
