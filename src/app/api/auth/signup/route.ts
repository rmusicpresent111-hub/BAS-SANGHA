import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, signToken, cookieHeader } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  if (!rateLimit(`signup:${clientIp(req)}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again after 10 minutes.' },
      { status: 429 }
    )
  }
  if (Math.random() < 0.05) pruneRateLimits()

  try {
    const body = await req.json()
    // length caps: name/email flow into every JWT payload and admin list — an
    // unbounded name could blow up the token (cookies break at ~4 KB)
    const name = String(body.name || '').trim().slice(0, 80)
    const email = String(body.email || '').toLowerCase().trim().slice(0, 254)
    const password = String(body.password || '').slice(0, 128)

    if (!name || !email || !password)
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    if (!/^\S+@\S+\.\S+$/.test(email))
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    if (password.length < 6)
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

    const existing = await db.user.findUnique({ where: { email } })
    if (existing)
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })

    const user = await db.user.create({
      data: { name, email, passwordHash: hashPassword(password) },
    })

    const token = signToken({ uid: user.id, email: user.email, role: user.role, name: user.name })
    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token, // client keeps this for Bearer auth where cookies are blocked (iframe preview)
    })
    res.headers.append('Set-Cookie', cookieHeader(token))
    return res
  } catch (e) {
    console.error('signup error', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
