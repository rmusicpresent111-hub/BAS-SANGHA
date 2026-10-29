/**
 * Create/update ALL tables on a remote libSQL/Turso database from
 * prisma/schema.prisma. Needed because the Prisma CLI cannot push directly
 * to remote libsql:// URLs with the sqlite provider.
 *
 * Usage:
 *   DATABASE_URL="libsql://your-db.turso.io" \
 *   DATABASE_AUTH_TOKEN="your-token" \
 *   node scripts/turso-push.mjs
 *
 * Safe to re-run: CREATE TABLE IF NOT EXISTS / CREATE UNIQUE INDEX IF NOT EXISTS.
 */
import { createClient } from '@libsql/client'
import { execSync } from 'node:child_process'

const url = process.env.DATABASE_URL || ''
if (!url.startsWith('libsql:')) {
  console.error('ERROR: set DATABASE_URL="libsql://..." (and DATABASE_AUTH_TOKEN) first.')
  console.error('Example: DATABASE_URL="libsql://bas-sangha-yourname.turso.io" DATABASE_AUTH_TOKEN="..." node scripts/turso-push.mjs')
  process.exit(1)
}

console.log('Generating SQL from prisma/schema.prisma ...')
const sql = execSync(
  'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
  { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] },
)

const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
})

await client.executeMultiple(sql)
const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
)
console.log(
  'Schema applied. Tables:',
  tables.rows.map((r) => r.name).join(', '),
)
client.close()
