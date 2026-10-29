import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, signToken, cookieHeader } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  if (!rateLimit(`login:${clientIp(req)}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again after 10 minutes.' },
      { status: 429 }
    )
  }
  if (Math.random() < 0.05) pruneRateLimits()

  try {
    const body = await req.json()
    const email = String(body.email || '').toLowerCase().trim()
    const password = String(body.password || '')

    if (!email || !password)
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

    const user = await db.user.findUnique({ where: { email } })
    if (!user || !verifyPassword(password, user.passwordHash))
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    const token = signToken({ uid: user.id, email: user.email, role: user.role, name: user.name })
    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token, // client keeps this for Bearer auth where cookies are blocked (iframe preview)
    })
    res.headers.append('Set-Cookie', cookieHeader(token))
    return res
  } catch (e) {
    console.error('login error', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
