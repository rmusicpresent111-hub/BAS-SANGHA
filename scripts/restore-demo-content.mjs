/**
 * Restore demo/content rows on the REMOTE database from the pre-reset backup.
 *
 * Restores (whitelist — visible content only, per user request):
 *   Banner (4 demo rows; skips old test banners), QuickAction, PujoHighlight,
 *   Notice, Event, CommitteeMember, GalleryPhoto, plus the StoredFile rows
 *   referenced by restored committee/gallery photos.
 *
 * Deliberately NOT restored (demo submissions, wiped earlier at the user's
 * request): Donation, MemberRequest, TournamentRequest, DrawingRequest,
 * BloodRequest. Existing remote rows are never modified or deleted.
 *
 * Idempotent: INSERT OR IGNORE on primary keys — safe to run twice.
 *
 * Usage (from project root):
 *   DATABASE_URL="libsql://..." DATABASE_AUTH_TOKEN="..." \
 *   node scripts/restore-demo-content.mjs            # remote (Turso)
 *   DATABASE_URL="file:./db/restore-test.db" \
 *   node scripts/restore-demo-content.mjs            # local test
 */
import { createClient } from '@libsql/client'
import fs from 'fs'

const remoteUrl = process.env.DATABASE_URL || ''
if (!remoteUrl) {
  console.error('ERROR: set DATABASE_URL (libsql://... or file:...) and DATABASE_AUTH_TOKEN for remote.')
  process.exit(1)
}

const BACKUP = process.env.BACKUP_FILE || 'db/backup-before-demo-reset-1793272487689.json'
if (!fs.existsSync(BACKUP)) {
  console.error(`ERROR: backup file not found: ${BACKUP}`)
  process.exit(1)
}
const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'))

const remote = createClient({
  url: remoteUrl,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
})

// Test banner ("Ok ok tutntuni") was the user's throwaway upload — skip it.
const SKIP_BANNER_TITLES = new Set(['Ok ok tutntuni'])

const TABLES = [
  { name: 'Banner', pk: 'id', cols: ['id', 'title', 'subtitle', 'badge', 'imageUrl', 'objectFit', 'sortOrder', 'active', 'createdAt'] },
  { name: 'QuickAction', pk: 'id', cols: ['id', 'label', 'icon', 'color', 'link', 'sortOrder', 'active'] },
  { name: 'PujoHighlight', pk: 'id', cols: ['id', 'badge', 'title', 'subtitle', 'location', 'dateText', 'imageUrl', 'detailImageUrl', 'active'] },
  { name: 'Notice', pk: 'id', cols: ['id', 'title', 'body', 'createdAt', 'active'] },
  { name: 'Event', pk: 'id', cols: ['id', 'type', 'title', 'bannerUrl', 'description', 'eventDate', 'venue', 'fee', 'active', 'sortOrder'] },
  { name: 'CommitteeMember', pk: 'id', cols: ['id', 'name', 'role', 'phone', 'photoUrl', 'sortOrder', 'active', 'createdAt'] },
  { name: 'GalleryPhoto', pk: 'id', cols: ['id', 'year', 'caption', 'imageUrl', 'createdAt'] },
]

function existingKeys(table, pk) {
  return remote.execute(`SELECT ${pk} FROM ${table}`).then((r) => new Set(r.rows.map((row) => String(row[pk]))))
}

async function restoreTable({ name, pk, cols }) {
  const rows = backup[name] || []
  const have = await existingKeys(name, pk)
  let inserted = 0
  for (const row of rows) {
    if (name === 'Banner' && SKIP_BANNER_TITLES.has(row.title)) continue
    if (have.has(String(row[pk]))) continue // already there — never touch existing rows
    const placeholders = cols.map(() => '?').join(', ')
    await remote.execute({
      sql: `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${placeholders})`,
      args: cols.map((c) => (row[c] === undefined ? null : row[c])),
    })
    inserted++
  }
  const total = (await remote.execute(`SELECT COUNT(*) AS n FROM ${name}`)).rows[0].n
  console.log(`${name}: inserted ${inserted}/${rows.length} (skipped existing) -> total on remote: ${total}`)
}

/** Collect /api/files?name=... referenced by the rows we restore. */
function referencedStoredFiles() {
  const names = new Set()
  const grab = (url) => {
    const m = String(url || '').match(/[?&]name=([^&]+)/)
    if (m) names.add(decodeURIComponent(m[1]))
  }
  for (const m of backup.CommitteeMember || []) grab(m.photoUrl)
  for (const g of backup.GalleryPhoto || []) grab(g.imageUrl)
  return names
}

async function restoreStoredFiles() {
  const wanted = referencedStoredFiles()
  const rows = (backup.StoredFile || []).filter((s) => wanted.has(s.name))
  const have = await existingKeys('StoredFile', 'name')
  let inserted = 0
  for (const row of rows) {
    if (have.has(row.name)) continue
    await remote.execute({
      sql: 'INSERT INTO StoredFile (name, mime, size, data, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [row.name, row.mime, row.size, row.data, row.createdAt],
    })
    inserted++
  }
  console.log(`StoredFile: inserted ${inserted}/${rows.length} (only member/gallery photos; receipts & test files skipped)`)
}

console.log(`Restore target: ${remoteUrl.replace(/:[^:@/]+@/, ':***@')}`)
console.log(`Backup: ${BACKUP}\n`)
for (const t of TABLES) await restoreTable(t)
await restoreStoredFiles()
console.log('\n✓ Restore complete. Users/Settings untouched; demo submissions (donations/requests) stay wiped as requested earlier.')
remote.close()
