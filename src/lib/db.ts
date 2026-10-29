import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

/**
 * Single Prisma client for the whole app, with transparent hosting support:
 *
 * - Local dev:      DATABASE_URL=file:...          → plain SQLite engine
 * - Vercel/prod:    DATABASE_URL=libsql://...      → official libSQL driver
 *                     (+ DATABASE_AUTH_TOKEN)        adapter (Turso, etc.)
 *
 * Vercel serverless filesystems are ephemeral, so production always needs a
 * hosted libSQL/SQLite database. Same schema, same queries — only the
 * connection layer changes.
 */
function makePrisma(): PrismaClient {
  const url = process.env.DATABASE_URL || ''

  if (url.startsWith('libsql:')) {
    // adapter-libsql v6 takes the libsql Config (url + authToken) directly and
    // creates/manages the client internally. Passing a Client instance breaks
    // it ("The URL 'undefined' is not in a valid format").
    return new PrismaClient({
      adapter: new PrismaLibSQL({
        url,
        authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
      }),
      // Security audit: query-level logging printed emails/phones/UTRs into
      // server logs. Only errors are logged now (and they stay server-side).
      log: ['error'],
    })
  }

  return new PrismaClient({ log: ['error'] })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? makePrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
