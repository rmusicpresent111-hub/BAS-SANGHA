/**
 * Validates the runtime migration used in production (src/lib/drawing-migrate.ts):
 * 1. copy the local DB, DROP the 3 new columns (simulating the old Turso schema)
 * 2. run the same PRAGMA + conditional ALTER logic
 * 3. verify the columns exist again
 */
import { createClient } from '@libsql/client'
import { execSync } from 'node:child_process'
import { cpSync, rmSync } from 'node:fs'

const TEST = '/tmp/mig-test.db'
rmSync(TEST, { force: true })
cpSync('/home/z/my-project/db/custom.db', TEST)

const client = createClient({ url: `file:${TEST}` })

const cols = async () => (await client.execute(`PRAGMA table_info("DrawingRequest")`)).rows.map((r) => r.name)

// step 1: simulate old schema
for (const c of ['phone', 'fee', 'utr']) {
  if ((await cols()).includes(c)) await client.execute(`ALTER TABLE "DrawingRequest" DROP COLUMN "${c}"`)
}
let before = await cols()
console.log('after drop:', before.join(','))
if (before.includes('phone') || before.includes('fee') || before.includes('utr')) {
  console.error('❌ could not simulate old schema (DROP COLUMN failed)')
  process.exit(1)
}

// step 2: same logic as ensureDrawingColumns()
const names = new Set(before)
if (!names.has('phone')) await client.execute(`ALTER TABLE "DrawingRequest" ADD COLUMN "phone" TEXT NOT NULL DEFAULT ''`)
if (!names.has('fee')) await client.execute(`ALTER TABLE "DrawingRequest" ADD COLUMN "fee" INTEGER NOT NULL DEFAULT 0`)
if (!names.has('utr')) await client.execute(`ALTER TABLE "DrawingRequest" ADD COLUMN "utr" TEXT`)

// step 3: verify + old rows survive with defaults
const after = await cols()
const sample = await client.execute(`SELECT name, phone, fee, utr FROM "DrawingRequest" LIMIT 3`)
console.log('after migrate:', after.join(','))
console.log('sample rows:', JSON.stringify(sample.rows))

const okCols = ['phone', 'fee', 'utr'].every((c) => after.includes(c))
console.log(okCols ? '✅ migration logic verified' : '❌ migration failed')
process.exit(okCols ? 0 : 1)
