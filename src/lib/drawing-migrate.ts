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

let payDone = false

/**
 * Runtime schema guard for the paymentMethod columns (QR | CASH) on every
 * fee-bearing table. Same trick as ensureDrawingColumns: the production Turso
 * DB predates the column, so each server instance adds the (idempotent)
 * ALTER TABLEs once on the first payment-related request. Safe to run
 * concurrently and re-run.
 */
export async function ensurePaymentMethodColumns(): Promise<void> {
  if (payDone) return
  try {
    const tables = ['Donation', 'MemberRequest', 'TournamentRequest', 'DrawingRequest']
    for (const t of tables) {
      const cols = (await db.$queryRawUnsafe<{ name: string }[]>(
        `PRAGMA table_info("${t}")`
      )) as { name: string }[]
      const names = new Set((cols || []).map((c) => c.name))
      if (!names.has('paymentMethod'))
        await db.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'QR'`)
    }
    payDone = true
  } catch (e) {
    // never cache a failure — the next request retries (e.g. cold-start race)
    console.error('ensurePaymentMethodColumns failed (will retry)', e)
  }
}
