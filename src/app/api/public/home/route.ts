import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // audit: light throttle against scraping/DDoS (generous for real users)
  if (!rateLimit(`pubhome:${clientIp(req)}`, 120, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()
  try {
    const [banners, members, events, settings, quickActions, highlights, notices] = await Promise.all([
      db.banner.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      db.committeeMember.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      db.event.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      db.setting.findMany(),
      db.quickAction.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      db.pujoHighlight.findMany({ where: { active: true }, take: 1 }),
      db.notice.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ])
    const settingsMap: Record<string, string> = {}
    // Whitelist: only settings that are safe to expose publicly. This keeps
    // private keys (e.g. the admin resetCode) out of the public response.
    const PUBLIC_KEYS = new Set([
      'upiId',
      'upiName',
      'memberFee',
      'headerTagline',
      'headerQuote',
      'memberJoinSubtitle',
      'clubAddress',
    ])
    for (const s of settings) if (PUBLIC_KEYS.has(s.key)) settingsMap[s.key] = s.value
    // admin can hide committee phone numbers from the public app
    const hidePhones = (settings.find((s) => s.key === 'hideCommitteePhone')?.value === '1')
    const publicMembers = hidePhones
      ? members.map((m) => ({ ...m, phone: '' }))
      : members
    return NextResponse.json({
      banners,
      members: publicMembers,
      events,
      settings: settingsMap,
      quickActions,
      highlight: highlights[0] || null,
      notices,
    })
  } catch (e) {
    console.error('public home error', e)
    return NextResponse.json({ error: 'Failed to load home data' }, { status: 500 })
  }
}
