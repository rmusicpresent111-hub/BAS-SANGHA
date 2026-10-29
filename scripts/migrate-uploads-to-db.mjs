/**
 * One-time migration: move files from the old disk-based uploads/ directory
 * into the new StoredFile DB table (Vercel-safe storage).
 *
 * Run from the project root:  bun scripts/migrate-uploads-to-db.mjs
 * Safe to re-run (upsert by file name).
 */
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const UPLOAD_DIR = '/home/z/my-project/uploads'
const MIMES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

const db = new PrismaClient()

let moved = 0
let skipped = 0
try {
  for (const f of fs.readdirSync(UPLOAD_DIR)) {
    const ext = (f.split('.').pop() || '').toLowerCase()
    if (!MIMES[ext]) {
      skipped++
      continue
    }
    const buf = fs.readFileSync(path.join(UPLOAD_DIR, f))
    const data = { name: f, mime: MIMES[ext], size: buf.length, data: buf.toString('base64') }
    await db.storedFile.upsert({ where: { name: f }, update: data, create: data })
    moved++
  }
  console.log(`migrated ${moved} file(s) into StoredFile, skipped ${skipped}`)
} finally {
  await db.$disconnect()
}
