import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

/**
 * Global payment-proof (UTR) reuse guard.
 *
 * A single real payment has exactly ONE UTR — so the same UTR must never be
 * accepted for two records, no matter which flow it was submitted through
 * (donation / member join / tournament / drawing entry). Every payment
 * endpoint calls this before accepting a new submission.
 *
 * UTRs are ALWAYS compared uppercase — every write path must normalize with
 * .toUpperCase() before storing (see the pay/member/tournament routes).
 *
 * The caller supplies the rejection message to keep UX wording per-flow.
 * Returns null when the UTR is free, or an error string when it is taken.
 * Accepts an optional transaction client so the check + write can run
 * atomically (SQLite serializes transactions — closes the TOCTOU race).
 */
type TxClient = Prisma.TransactionClient | typeof db

export async function findUtrConflict(
  utr: string,
  client: TxClient = db,
): Promise<'donation' | 'member' | 'tournament' | 'drawing' | null> {
  const u = utr.toUpperCase()
  const [donation, member, tournament, drawing] = await Promise.all([
    client.donation.findFirst({
      where: { utr: u, status: { in: ['SUBMITTED', 'VERIFIED'] } },
      select: { id: true },
    }),
    client.memberRequest.findFirst({
      where: { utr: u, status: { in: ['WAITING', 'APPROVED'] } },
      select: { id: true },
    }),
    client.tournamentRequest.findFirst({
      where: { utr: u, status: { in: ['WAITING', 'APPROVED'] } },
      select: { id: true },
    }),
    client.drawingRequest.findFirst({
      where: { utr: u, status: { in: ['WAITING', 'APPROVED'] } },
      select: { id: true },
    }),
  ])
  if (donation) return 'donation'
  if (member) return 'member'
  if (tournament) return 'tournament'
  if (drawing) return 'drawing'
  return null
}

export const UTR_TAKEN_MSG =
  'This UTR number has already been submitted. Please enter the UTR of your own payment.'
