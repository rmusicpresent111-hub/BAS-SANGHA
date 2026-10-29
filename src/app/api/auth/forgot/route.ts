import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, safeEqualStr, invalidateUserTokensBefore } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

/**
 * Password reset without OTP.
 *
 * Security rules (hardened during the security audit):
 * - ADMIN accounts must supply the club "Reset Code" (Setting.resetCode),
 *   compared timing-safely.
 * - USER (member) accounts must supply the phone number recorded on their
 *   latest member-join request — otherwise anyone who knew an email could
 *   take over the account. Members without a member-join request (plain app
 *   users with no stored PII) can reset with email alone.
 * - Rate limited per IP: 3 attempts / 15 min (audit: brute-force throttle).
 * - After a successful reset, ALL tokens issued before this moment for the
 *   user are invalidated — a stolen session cannot survive a reset.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`forgot:${clientIp(req)}`, 3, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again after 15 minutes.' },
      { status: 429 }
    )
  }
  if (Math.random() < 0.05) pruneRateLimits()

  try {
    const body = await req.json()
    const email = String(body.email || '').toLowerCase().trim()
    const newPassword = String(body.newPassword || '')
    const resetCode = String(body.resetCode || '').trim()
    const phoneDigits = String(body.phone || '').replace(/\D/g, '').slice(-10)

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    if (newPassword.length < 6)
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })

    const user = await db.user.findUnique({ where: { email } })
    if (!user)
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 })

    if (user.role === 'ADMIN') {
      const setting = await db.setting.findUnique({ where: { key: 'resetCode' } })
      const expected = setting?.value?.trim()
      if (!expected)
        return NextResponse.json(
          { error: 'Admin reset is disabled — set a Reset Code in Admin Panel → Settings first.' },
          { status: 403 }
        )
      if (!safeEqualStr(resetCode, expected))
        return NextResponse.json(
          { error: 'Invalid reset code for the admin account.' },
          { status: 403 }
        )
    } else {
      // member account — verify the registered phone when we have one on file
      const memberReq = await db.memberRequest.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      })
      if (memberReq?.phone) {
        if (!phoneDigits)
          return NextResponse.json(
            { error: 'Members must enter their registered mobile number to reset the password.' },
            { status: 403 }
          )
        if (phoneDigits !== memberReq.phone)
          return NextResponse.json(
            { error: 'This mobile number does not match our records for this account.' },
            { status: 403 }
          )
      }
    }

    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } })
    // kill every existing session of this user (tokens issued <= now)
    await invalidateUserTokensBefore(user.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('forgot error', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
