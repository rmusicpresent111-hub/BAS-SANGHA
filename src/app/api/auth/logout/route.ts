import { NextRequest, NextResponse } from 'next/server'
import { clearCookieHeader, verifyToken, revokeToken } from '@/lib/auth'

/**
 * Logout: clears the session cookie AND revokes the presented JWT server-side
 * (in-memory jti blacklist until its natural expiry), so a copied token can
 * no longer be replayed after logout.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const payload = verifyToken(auth.slice(7).trim())
    if (payload) await revokeToken(payload)
  }
  const res = NextResponse.json({ ok: true })
  res.headers.append('Set-Cookie', clearCookieHeader())
  return res
}
