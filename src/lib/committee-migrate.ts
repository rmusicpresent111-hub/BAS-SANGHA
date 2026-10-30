import { db } from '@/lib/db'

let done = false

/**
 * Runtime schema guard for CommitteeMember.phoneVisible (per-member
 * phone hide/unhide in the public app).
 *
 * The production Turso database predates this deploy and the Prisma CLI
 * cannot push to remote libsql:// URLs — so instead of asking the user to
 * run a migration, every server instance applies the (idempotent)
 * ALTER TABLE once on the first committee-related request. Local dev
 * already has the column via `prisma db push`, making this a cheap no-op.
 *
 * PRAGMA table_info + conditional ALTER TABLE = safe to call concurrently
 * and re-run; the module-level flag just avoids the extra PRAGMA per request.
 */
export async function ensureCommitteePhoneVisibleColumn(): Promise<void> {
  if (done) return
  try {
    const cols = (await db.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info("CommitteeMember")`
    )) as { name: string }[]
    const names = new Set((cols || []).map((c) => c.name))
    if (!names.has('phoneVisible'))
      await db.$executeRawUnsafe(`ALTER TABLE "CommitteeMember" ADD COLUMN "phoneVisible" BOOLEAN NOT NULL DEFAULT 1`)
    done = true
  } catch (e) {
    // never cache a failure — the next request retries (e.g. cold-start race)
    console.error('ensureCommitteePhoneVisibleColumn failed (will retry)', e)
  }
}
