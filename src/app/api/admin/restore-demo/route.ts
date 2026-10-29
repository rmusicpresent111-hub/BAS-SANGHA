import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'

/** Backup content (from the pre-reset Turso dump). Read at runtime instead of
 * a static JSON import — a ~5 MB literal would slow TS/bundler down. The file
 * ships with the function via next.config.ts outputFileTracingIncludes. */
function loadRestoreData(): Record<string, unknown[]> {
  const file = path.join(process.cwd(), 'src/app/api/admin/restore-demo/restore-data.json')
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown[]>
}

/**
 * POST /api/admin/restore-demo — one-click restore of the club's demo/home
 * content (banners, quick actions, pujo highlight, notices, events, committee
 * members + their uploaded photos, gallery) from the pre-reset backup.
 *
 * - ADMIN session required (same as every other admin route)
 * - Idempotent: rows that already exist are skipped; nothing is ever deleted
 *   or overwritten — the admin's own banners/members always survive.
 * - Demo submissions (donations / join / tournament / drawing / blood
 *   requests) are intentionally NOT restored.
 */

type Row = Record<string, unknown>

const deny = () => NextResponse.json({ error: 'Forbidden' }, { status: 403 })
const dt = (v: unknown) => new Date((v as string | number) ?? Date.now())
const bool = (v: unknown) => Boolean(Number(v ?? 1))
const str = (v: unknown, fallback = '') => (v == null ? fallback : String(v))
const strOrNull = (v: unknown) => (v == null ? null : String(v))
const num = (v: unknown, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export async function POST(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  if (!rateLimit(`restore:${clientIp(req)}`, 3, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()

  const summary: Record<string, number> = {}
  const restoreData = loadRestoreData()
  try {
    // 1) StoredFile first — member/gallery photos point at /api/files?name=...
    {
      const have = new Set((await db.storedFile.findMany({ select: { name: true } })).map((x) => x.name))
      const rows = ((restoreData.StoredFile ?? []) as Row[]).filter((r) => !have.has(str(r.name)))
      for (const r of rows)
        await db.storedFile.create({
          data: { name: str(r.name), mime: str(r.mime, 'application/octet-stream'), size: num(r.size), data: str(r.data), createdAt: dt(r.createdAt) },
        })
      summary.StoredFile = rows.length
    }

    // 2) Hero banners
    {
      const have = new Set((await db.banner.findMany({ select: { id: true } })).map((x) => x.id))
      const rows = ((restoreData.Banner ?? []) as Row[]).filter((r) => !have.has(str(r.id)))
      for (const r of rows)
        await db.banner.create({
          data: { id: str(r.id), title: str(r.title), subtitle: strOrNull(r.subtitle), badge: strOrNull(r.badge), imageUrl: str(r.imageUrl), objectFit: str(r.objectFit, 'cover'), sortOrder: num(r.sortOrder), active: bool(r.active), createdAt: dt(r.createdAt) },
        })
      summary.Banner = rows.length
    }

    // 3) Quick actions
    {
      const have = new Set((await db.quickAction.findMany({ select: { id: true } })).map((x) => x.id))
      const rows = ((restoreData.QuickAction ?? []) as Row[]).filter((r) => !have.has(str(r.id)))
      for (const r of rows)
        await db.quickAction.create({
          data: { id: str(r.id), label: str(r.label), icon: str(r.icon, 'landmark'), color: str(r.color, 'violet'), link: str(r.link, 'home'), sortOrder: num(r.sortOrder), active: bool(r.active) },
        })
      summary.QuickAction = rows.length
    }

    // 4) Pujo highlight (শ্রী শ্রী শ্যামা পুজা banner)
    {
      const have = new Set((await db.pujoHighlight.findMany({ select: { id: true } })).map((x) => x.id))
      const rows = ((restoreData.PujoHighlight ?? []) as Row[]).filter((r) => !have.has(str(r.id)))
      for (const r of rows)
        await db.pujoHighlight.create({
          data: { id: str(r.id), badge: str(r.badge, 'সর্বজনীন'), title: str(r.title), subtitle: strOrNull(r.subtitle), location: strOrNull(r.location), dateText: strOrNull(r.dateText), imageUrl: str(r.imageUrl, '/images/kali-maa.png'), detailImageUrl: strOrNull(r.detailImageUrl), active: bool(r.active) },
        })
      summary.PujoHighlight = rows.length
    }

    // 5) Notices
    {
      const have = new Set((await db.notice.findMany({ select: { id: true } })).map((x) => x.id))
      const rows = ((restoreData.Notice ?? []) as Row[]).filter((r) => !have.has(str(r.id)))
      for (const r of rows)
        await db.notice.create({
          data: { id: str(r.id), title: str(r.title), body: str(r.body), createdAt: dt(r.createdAt), active: bool(r.active) },
        })
      summary.Notice = rows.length
    }

    // 6) Events (type is unique — skip rows whose type already exists too)
    {
      const ids = await db.event.findMany({ select: { id: true, type: true } })
      const haveIds = new Set(ids.map((x) => x.id))
      const types = new Set(ids.map((x) => x.type))
      const rows = ((restoreData.Event ?? []) as Row[]).filter((r) => !haveIds.has(str(r.id)) && !types.has(str(r.type)))
      for (const r of rows)
        await db.event.create({
          data: { id: str(r.id), type: str(r.type), title: str(r.title), bannerUrl: str(r.bannerUrl), description: strOrNull(r.description), eventDate: strOrNull(r.eventDate), venue: strOrNull(r.venue), fee: num(r.fee), active: bool(r.active), sortOrder: num(r.sortOrder) },
        })
      summary.Event = rows.length
    }

    // 7) Committee members
    {
      const have = new Set((await db.committeeMember.findMany({ select: { id: true } })).map((x) => x.id))
      const rows = ((restoreData.CommitteeMember ?? []) as Row[]).filter((r) => !have.has(str(r.id)))
      for (const r of rows)
        await db.committeeMember.create({
          data: { id: str(r.id), name: str(r.name), role: str(r.role, 'Member'), phone: str(r.phone), photoUrl: str(r.photoUrl), sortOrder: num(r.sortOrder), active: bool(r.active), createdAt: dt(r.createdAt) },
        })
      summary.CommitteeMember = rows.length
    }

    // 8) Gallery photos
    {
      const have = new Set((await db.galleryPhoto.findMany({ select: { id: true } })).map((x) => x.id))
      const rows = ((restoreData.GalleryPhoto ?? []) as Row[]).filter((r) => !have.has(str(r.id)))
      for (const r of rows)
        await db.galleryPhoto.create({
          data: { id: str(r.id), year: str(r.year, '2025'), caption: strOrNull(r.caption), imageUrl: str(r.imageUrl), createdAt: dt(r.createdAt) },
        })
      summary.GalleryPhoto = rows.length
    }

    const total = Object.values(summary).reduce((a, b) => a + b, 0)
    return NextResponse.json({
      ok: true,
      restored: summary,
      total,
      message: total === 0 ? 'সব কনটেন্ট আগেই আছে — নতুন কিছু যোগ করার দরকার হয়নি।' : `${total} টি কনটেন্ট ফিরিয়ে আনা হয়েছে।`,
    })
  } catch (e) {
    console.error('restore-demo failed:', e)
    return NextResponse.json({ error: 'Restore failed — আবার চেষ্টা করুন।' }, { status: 500 })
  }
}
