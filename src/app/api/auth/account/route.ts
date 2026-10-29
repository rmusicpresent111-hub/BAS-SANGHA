import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { getUser, hashPassword, invalidateUserTokensBefore, revokeToken, verifyToken } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rate-limit'

/**
 * DELETE /api/auth/account — user-initiated account deletion.
 *
 * Security/privacy audit requirement: users must be able to remove or
 * anonymize their personal data.
 *
 * What happens:
 * - The User row is anonymized (name/email/password unusable) and kept only
 *   as a foreign-key anchor for financial records.
 * - All four request types of the user (member join / tournament / drawing /
 *   blood) are DELETED — they are personal records tied to the person.
 * - Donations are kept but anonymized (payerPhone cleared): they are payment
 *   records (orderId / UTR / amount) that admin reconciliation relies on.
 * - Every existing session token of the user is invalidated and the current
 *   token is revoked.
 * - ADMIN accounts cannot be deleted here (managed by the club, not self-serve).
 */
export async function DELETE(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit(`delacct:${session.uid}:${clientIp(req)}`, 3, 60 * 60 * 1000))
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })

  try {
    const user = await db.user.findUnique({ where: { id: session.uid } })
    if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    if (user.role === 'ADMIN')
      return NextResponse.json(
        { error: 'Admin account cannot be deleted from the app.' },
        { status: 403 }
      )

    // remove the user's personal request records
    await db.memberRequest.deleteMany({ where: { userId: user.id } })
    await db.tournamentRequest.deleteMany({ where: { userId: user.id } })
    await db.drawingRequest.deleteMany({ where: { userId: user.id } })
    await db.bloodRequest.deleteMany({ where: { userId: user.id } })

    // anonymize the account (kept as FK anchor for donations)
    await db.user.update({
      where: { id: user.id },
      data: {
        name: 'Former member',
        email: `deleted-${user.id}@invalid.local`,
        passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')), // unusable
      },
    })

    // anonymize donations (financial records stay for reconciliation)
    await db.donation.updateMany({
      where: { userId: user.id },
      data: { payerPhone: '', payerName: 'Former member' },
    })

    // kill every session of this user, including the current one
    await invalidateUserTokensBefore(user.id)
    const auth = req.headers.get('authorization')
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const payload = verifyToken(auth.slice(7).trim())
      if (payload) await revokeToken(payload)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('account delete error', e)
    return NextResponse.json({ error: 'Could not delete the account. Please try again.' }, { status: 500 })
  }
}
