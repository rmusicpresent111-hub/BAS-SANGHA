/**
 * Export public content (banners, events, committee, settings, ...) from the
 * LOCAL database into prisma/seed-content.json, so it can be seeded into a
 * fresh production database (Turso) with scripts/seed-content.mjs.
 *
 * Only public content tables are exported — users, requests, donations,
 * push tokens and revoked tokens are NEVER included.
 *
 * Run from the project root:  bun scripts/export-content.mjs
 */
import fs from 'fs'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const data = {
  committeeMembers: await db.committeeMember.findMany({ orderBy: { sortOrder: 'asc' } }),
  banners: await db.banner.findMany({ orderBy: { sortOrder: 'asc' } }),
  quickActions: await db.quickAction.findMany({ orderBy: { sortOrder: 'asc' } }),
  pujoHighlights: await db.pujoHighlight.findMany(),
  notices: await db.notice.findMany({ orderBy: { createdAt: 'desc' } }),
  events: await db.event.findMany({ orderBy: { sortOrder: 'asc' } }),
  galleryPhotos: await db.galleryPhoto.findMany({ orderBy: { createdAt: 'desc' } }),
  // Never export secrets — resetCode lets anyone reset the admin password.
  settings: (await db.setting.findMany()).filter(
    (s) => !['resetCode'].includes(s.key),
  ),
}

fs.writeFileSync('prisma/seed-content.json', JSON.stringify(data, null, 2))
console.log(
  'exported:',
  Object.entries(data)
    .map(([k, v]) => `${k}=${v.length}`)
    .join(', '),
)
await db.$disconnect()
