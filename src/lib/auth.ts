import crypto from 'crypto'
import { db } from '@/lib/db'

/**
 * AUTH_SECRET is required — the app refuses to boot without it.
 * (Security audit: a hardcoded fallback secret let anyone forge admin JWTs.
 * A strong 64-hex secret now lives in .env, which is gitignored.)
 */
const SECRET = process.env.AUTH_SECRET
if (!SECRET || SECRET.length < 32) {
  throw new Error('AUTH_SECRET env var is required (at least 32 chars). Generate one with: openssl rand -hex 32')
}

export const COOKIE_NAME = 'bas_token'

export type TokenPayload = {
  uid: string
  email: string
  role: string
  name: string
  exp: number
  iat?: number
  jti?: string // unique token id — used for logout revocation
}

/* ------------------------------------------------------------------ */
/* Server-side token revocation.                                       */
/* Source of truth is the DATABASE (RevokedToken + User.tokens-        */
/* InvalidatedAt) so revocation survives server restarts and works     */
/* across route-bundle module instances. An in-memory mirror acts as   */
/* an L1 fast-path within the same process.                            */
/* - revokeToken: one specific token (logout) is dead until exp.       */
/* - invalidateUserTokensBefore: after a password reset / account      */
/*   deletion every token issued up to that moment is dead.            */
/* ------------------------------------------------------------------ */
const revokedJti = new Map<string, number>()
const invalidatedBefore = new Map<string, number>()

function pruneRevocation() {
  const now = Math.floor(Date.now() / 1000)
  for (const [jti, exp] of revokedJti) if (exp <= now) revokedJti.delete(jti)
  // invalidatedBefore entries are small (one per user) — keep them.
}

/** Revoke ONE token (logout). Persists to DB — await at the call site. */
export async function revokeToken(payload: TokenPayload): Promise<void> {
  if (!payload.jti) return
  if (revokedJti.size > 2000) pruneRevocation()
  revokedJti.set(payload.jti, payload.exp)
  try {
    await db.revokedToken.upsert({
      where: { jti: payload.jti },
      update: { exp: payload.exp },
      create: { jti: payload.jti, exp: payload.exp },
    })
    // opportunistic pruning of expired rows (5% of calls, like rate limits)
    if (Math.random() < 0.05) {
      const now = Math.floor(Date.now() / 1000)
      await db.revokedToken.deleteMany({ where: { exp: { lte: now } } })
    }
  } catch (e) {
    // memory map still covers this process; DB write failure must not 500 a logout
    console.error('revokedToken persist failed', e)
  }
}

/** Invalidate every token issued before "now" for this user (password reset / delete). */
export async function invalidateUserTokensBefore(uid: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  invalidatedBefore.set(uid, now)
  try {
    await db.user.update({ where: { id: uid }, data: { tokensInvalidatedAt: now } })
  } catch (e) {
    console.error('invalidateUserTokensBefore persist failed', e)
  }
}

export function signToken(data: Omit<TokenPayload, 'exp' | 'iat' | 'jti'>, ttlSec = 60 * 60 * 24 * 30): string {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ ...data, iat: now, exp: now + ttlSec, jti: crypto.randomBytes(12).toString('hex') })
  ).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET as string).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

/** Signature + expiry only (sync). Revocation is checked separately (async). */
export function verifyToken(token?: string | null): TokenPayload | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, s] = parts
  const expected = crypto.createHmac('sha256', SECRET as string).update(`${h}.${p}`).digest('base64url')
  if (expected.length !== s.length) return null
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s))) return null
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString()) as TokenPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

async function isRevoked(p: TokenPayload): Promise<boolean> {
  if (p.jti && revokedJti.has(p.jti)) return true
  const threshold = invalidatedBefore.get(p.uid)
  if (threshold !== undefined && (p.iat ?? 0) <= threshold) return true
  // not revoked in this process instance — confirm against the DB
  try {
    if (p.jti && (await db.revokedToken.findUnique({ where: { jti: p.jti }, select: { jti: true } })))
      return true
    const user = await db.user.findUnique({
      where: { id: p.uid },
      select: { tokensInvalidatedAt: true },
    })
    // user deleted (e.g. admin reset-users) → every old session is dead now
    if (!user) return true
    if (user.tokensInvalidatedAt != null && (p.iat ?? 0) <= user.tokensInvalidatedAt) return true
  } catch (e) {
    // DB unreachable: fall back to the in-memory view rather than hard-failing
    console.error('revocation DB check failed', e)
  }
  return false
}

/**
 * Resolve the session from a request.
 * 1. Authorization: Bearer <token> header (works inside sandboxed iframes where
 *    third-party cookies are blocked, e.g. the preview panel)
 * 2. bas_token cookie (classic browser session)
 */
export async function getUser(req: Request): Promise<TokenPayload | null> {
  const auth = req.headers.get('authorization')
  let payload: TokenPayload | null = null
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    payload = verifyToken(auth.slice(7).trim())
  }
  if (!payload) {
    const cookie = req.headers.get('cookie') || ''
    const part = cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(COOKIE_NAME + '='))
    if (!part) return null
    const raw = part.slice(COOKIE_NAME.length + 1)
    try {
      payload = verifyToken(decodeURIComponent(raw))
    } catch {
      // malformed percent-encoding in the cookie must never 500 a handler
      payload = verifyToken(raw)
    }
  }
  if (!payload) return null
  if (await isRevoked(payload)) return null
  return payload
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(pw, salt, 64)
  const orig = Buffer.from(hash, 'hex')
  return orig.length === test.length && crypto.timingSafeEqual(orig, test)
}

/** timing-safe string compare for short secrets (reset codes etc). */
export function safeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

export function cookieHeader(token: string): string {
  // Secure: sent only over HTTPS (localhost http is exempt in modern browsers).
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
}

export function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}
