import crypto from 'crypto'
import { db } from '@/lib/db'

/**
 * Uploaded files (images/documents) are stored INSIDE the database as base64
 * rows (model StoredFile) instead of on disk. Vercel serverless functions
 * have a read-only, ephemeral filesystem — anything written to disk would be
 * lost between invocations. DB storage works identically locally and on
 * Vercel, and the public URL stays the same: /api/files?name=<name>.
 *
 * Security (unchanged from the disk version):
 * - extension whitelist + magic-byte content match (no HTML/JS in .png)
 * - 8 MB size cap
 * - generated unguessable names; reads reject paths and non-whitelisted exts
 */

const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf']

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

/**
 * Magic-byte signatures — the declared extension must match the real file
 * content. (Audit: extension-only checks let an HTML/JS payload hide behind
 * a .png name. With nosniff + fixed content types this is defense-in-depth.)
 */
function contentMatchesExt(ext: string, buf: Buffer): boolean {
  if (buf.length < 12) return false
  switch (ext) {
    case 'png':
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
    case 'jpg':
    case 'jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    case 'gif':
      return buf.slice(0, 3).toString('latin1') === 'GIF'
    case 'webp':
      return buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP'
    case 'pdf':
      return buf.slice(0, 4).toString('latin1') === '%PDF'
    default:
      return false
  }
}

/** Validates and stores an uploaded file in the DB. Returns the generated name or null. */
export async function saveUpload(file: File): Promise<string | null> {
  if (!file || typeof file === 'string') return null
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_EXT.includes(ext)) return null
  if (file.size > 8 * 1024 * 1024) return null
  const buf = Buffer.from(await file.arrayBuffer())
  if (!contentMatchesExt(ext, buf)) return null
  const name = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`
  await db.storedFile.create({
    data: { name, mime: MIME_TYPES[ext], size: buf.length, data: buf.toString('base64') },
  })
  return name
}

/** decoded-file cache — names are immutable (timestamp + random hex), so a
 * file's bytes never change and can be cached indefinitely. Avoids a remote
 * Turso round-trip + base64 decode on every view/optimizer request (was
 * ~4s per photo on serverless, now instant on warm instances). */
const fileCache = new Map<string, { buf: Buffer; type: string }>()
const FILE_CACHE_MAX_BYTES = 48 * 1024 * 1024 // ~48 MB total
let fileCacheBytes = 0

function cachePut(name: string, entry: { buf: Buffer; type: string }) {
  // evict oldest entries until the new one fits
  while (fileCache.size > 0 && fileCacheBytes + entry.buf.length > FILE_CACHE_MAX_BYTES) {
    const oldest = fileCache.keys().next().value
    if (oldest === undefined) break
    fileCacheBytes -= fileCache.get(oldest)!.buf.length
    fileCache.delete(oldest)
  }
  fileCache.set(name, entry)
  fileCacheBytes += entry.buf.length
}

/** Reads an uploaded file by name from the DB. Returns null for invalid/missing names. */
export async function safeReadUpload(name: string): Promise<{ buf: Buffer; type: string } | null> {
  if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) return null
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_EXT.includes(ext)) return null
  const cached = fileCache.get(name)
  if (cached) return cached
  const row = await db.storedFile.findUnique({ where: { name } })
  if (!row) return null
  const entry = { buf: Buffer.from(row.data, 'base64'), type: row.mime }
  cachePut(name, entry)
  return entry
}
