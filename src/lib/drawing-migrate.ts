import { db } from '@/lib/db'

let done = false

/**
 * Runtime schema guard for the new DrawingRequest columns (phone / fee / utr).
 *
 * The production Turso database predates this deploy and the Prisma CLI cannot
 * push to remote libsql:// URLs — so instead of asking the user to run a
 * migration, every server instance applies the (idempotent) ALTER TABLEs once
 * on the first drawing-related request. Local dev already has the columns via
 * `prisma db push`, making this a cheap no-op there.
 *
 * PRAGMA table_info + conditional ALTER TABLE = safe to call concurrently and
 * re-run; the module-level flag just avoids the extra PRAGMA per request.
 */
export async function ensureDrawingColumns(): Promise<void> {
  if (done) return
  try {
    const cols = (await db.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info("DrawingRequest")`
    )) as { name: string }[]
    const names = new Set((cols || []).map((c) => c.name))
    if (!names.has('phone'))
      await db.$executeRawUnsafe(`ALTER TABLE "DrawingRequest" ADD COLUMN "phone" TEXT NOT NULL DEFAULT ''`)
    if (!names.has('fee'))
      await db.$executeRawUnsafe(`ALTER TABLE "DrawingRequest" ADD COLUMN "fee" INTEGER NOT NULL DEFAULT 0`)
    if (!names.has('utr'))
      await db.$executeRawUnsafe(`ALTER TABLE "DrawingRequest" ADD COLUMN "utr" TEXT`)
    done = true
  } catch (e) {
    // never cache a failure — the next request retries (e.g. cold-start race)
    console.error('ensureDrawingColumns failed (will retry)', e)
  }
}
