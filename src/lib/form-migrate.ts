import { db } from '@/lib/db'

let done = false

/**
 * Runtime schema guard for the admin-editable event rules/forms feature:
 *   - Event.rules / formTitle / formNote / formFields
 *   - TournamentRequest.extraData / DrawingRequest.extraData / BloodRequest.extraData
 *
 * The production Turso database predates this deploy and the Prisma CLI
 * cannot push to remote libsql:// URLs — so instead of asking the user to
 * run a migration, every server instance applies the (idempotent) ALTER
 * TABLEs once on the first related request. Local dev already has the
 * columns via `prisma db push`, making this a cheap no-op there.
 *
 * PRAGMA table_info + conditional ALTER TABLE = safe to call concurrently
 * and re-run; the module-level flag just avoids the extra PRAGMA per request.
 *
 * IMPORTANT: once the Prisma client knows about these columns, EVERY select
 * on these models includes them — so every route that queries Event /
 * TournamentRequest / DrawingRequest / BloodRequest must await this first.
 */
export async function ensureFormColumns(): Promise<void> {
  if (done) return
  try {
    const plan: { table: string; col: string; ddl: string }[] = [
      { table: 'Event', col: 'rules', ddl: `ALTER TABLE "Event" ADD COLUMN "rules" TEXT` },
      { table: 'Event', col: 'formTitle', ddl: `ALTER TABLE "Event" ADD COLUMN "formTitle" TEXT` },
      { table: 'Event', col: 'formNote', ddl: `ALTER TABLE "Event" ADD COLUMN "formNote" TEXT` },
      { table: 'Event', col: 'formFields', ddl: `ALTER TABLE "Event" ADD COLUMN "formFields" TEXT` },
      { table: 'TournamentRequest', col: 'extraData', ddl: `ALTER TABLE "TournamentRequest" ADD COLUMN "extraData" TEXT` },
      { table: 'DrawingRequest', col: 'extraData', ddl: `ALTER TABLE "DrawingRequest" ADD COLUMN "extraData" TEXT` },
      { table: 'BloodRequest', col: 'extraData', ddl: `ALTER TABLE "BloodRequest" ADD COLUMN "extraData" TEXT` },
    ]
    const tables = [...new Set(plan.map((p) => p.table))]
    const colSets = new Map<string, Set<string>>()
    for (const t of tables) {
      const cols = (await db.$queryRawUnsafe<{ name: string }[]>(
        `PRAGMA table_info("${t}")`
      )) as { name: string }[]
      colSets.set(t, new Set((cols || []).map((c) => c.name)))
    }
    for (const p of plan) {
      if (!colSets.get(p.table)?.has(p.col)) await db.$executeRawUnsafe(p.ddl)
    }
    done = true
  } catch (e) {
    // never cache a failure — the next request retries (e.g. cold-start race)
    console.error('ensureFormColumns failed (will retry)', e)
  }
}
