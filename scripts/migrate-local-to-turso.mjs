/**
 * One-time data migration: local SQLite (db/custom.db) → remote Turso (libsql://).
 *
 * Copies every row of every Prisma table, preserving IDs and timestamps.
 * Idempotent-ish: skips tables that already have rows on the remote side.
 *
 * Usage (from project root):
 *   DATABASE_URL="libsql://..." DATABASE_AUTH_TOKEN="..." \
 *   node scripts/migrate-local-to-turso.mjs
 */
import { createClient } from '@libsql/client'

const LOCAL_URL = process.env.LOCAL_DB_URL || 'file:./db/custom.db'
const remoteUrl = process.env.DATABASE_URL || ''
if (!remoteUrl.startsWith('libsql:')) {
  console.error('ERROR: set DATABASE_URL (libsql://...) and DATABASE_AUTH_TOKEN first.')
  process.exit(1)
}

const local = createClient({ url: LOCAL_URL })
const remote = createClient({
  url: remoteUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
})

// Insert order: parents (User) first, then everything else.
const ORDER = [
  'User',
  'Banner', 'QuickAction', 'PujoHighlight', 'Notice', 'Event', 'Setting',
  'CommitteeMember', 'MemberRequest', 'TournamentRequest', 'DrawingRequest',
  'BloodRequest', 'GalleryPhoto', 'Donation', 'RevokedToken', 'PushToken',
  'StoredFile',
]

const remoteTables = await remote.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'",
)
const remoteSet = new Set(remoteTables.rows.map((r) => r.name))

let totalCopied = 0
let totalSkipped = 0

for (const table of ORDER) {
  if (!remoteSet.has(table)) {
    console.log(`SKIP ${table} (not in remote schema)`)
    continue
  }

  const remoteCount = await remote.execute(`SELECT COUNT(*) AS n FROM "${table}"`)
  const rCount = Number(remoteCount.rows[0].n)
  if (rCount > 0) {
    console.log(`SKIP ${table} (remote already has ${rCount} rows)`)
    totalSkipped += rCount
    continue
  }

  const colsRes = await remote.execute(`PRAGMA table_info("${table}")`)
  const cols = colsRes.rows.map((r) => r.name)
  const colList = cols.map((c) => `"${c}"`).join(', ')
  const placeholders = cols.map(() => '?').join(', ')

  const rows = await local.execute(`SELECT ${colList} FROM "${table}"`)
  const n = rows.rows.length
  if (n === 0) {
    console.log(`OK   ${table} (0 rows locally)`)
    continue
  }

  // Batch inserts in chunks of 25 statements.
  const CHUNK = 25
  for (let i = 0; i < n; i += CHUNK) {
    const slice = rows.rows.slice(i, i + CHUNK)
    const stmts = slice.map((row) => ({
      sql: `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
      args: cols.map((c) => row[c] ?? null),
    }))
    await remote.batch(stmts, 'write')
  }
  totalCopied += n
  console.log(`OK   ${table} → copied ${n} rows`)
}

console.log(`\nDONE. copied=${totalCopied}, skipped(existing)=${totalSkipped}`)
local.close()
remote.close()
