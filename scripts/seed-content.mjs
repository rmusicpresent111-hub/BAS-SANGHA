/**
 * Seed public content from prisma/seed-content.json into a (fresh) database.
 *
 * Local DB:      bun scripts/seed-content.mjs
 * Remote Turso:  DATABASE_URL="libsql://your-db.turso.io" \
 *                DATABASE_AUTH_TOKEN="your-token" \
 *                node scripts/seed-content.mjs
 *
 * Upserts by primary key — safe to run multiple times, never duplicates.
 */
import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const url = process.env.DATABASE_URL || ''
let db
if (url.startsWith('libsql:')) {
  const libsql = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  })
  db = new PrismaClient({ adapter: new PrismaLibSQL(libsql) })
} else {
  db = new PrismaClient()
}

const data = JSON.parse(
  fs.readFileSync(new URL('../prisma/seed-content.json', import.meta.url), 'utf8'),
)

/** Upsert a whole table. pk = primary key field of that model. */
async function upsertAll(model, rows, pk = 'id') {
  let n = 0
  for (const row of rows) {
    await db[model].upsert({ where: { [pk]: row[pk] }, update: row, create: row })
    n++
  }
  return n
}

let total = 0
total += await upsertAll('committeeMember', data.committeeMembers)
total += await upsertAll('banner', data.banners)
total += await upsertAll('quickAction', data.quickActions)
total += await upsertAll('pujoHighlight', data.pujoHighlights)
total += await upsertAll('notice', data.notices)
total += await upsertAll('event', data.events)
total += await upsertAll('galleryPhoto', data.galleryPhotos)
total += await upsertAll('setting', data.settings, 'key')

console.log(`seeded ${total} rows into ${url.startsWith('libsql:') ? 'remote DB' : 'local DB'}`)
await db.$disconnect()
