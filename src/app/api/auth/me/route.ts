import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ user: null }, { status: 401 })
  try {
    const user = await db.user.findUnique({ where: { id: session.uid } })
    if (!user) return NextResponse.json({ user: null }, { status: 401 })
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (e) {
    // DB/infra failure must NOT masquerade as "logged out" (clients would wipe
    // valid sessions). Only a missing/invalid token returns 401 above.
    console.error('auth/me error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
