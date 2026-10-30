import { db } from '@/lib/db'

/**
 * Auto-sync an APPROVED member into the public Committee list.
 *
 * Fired from the admin approval endpoint the moment a MemberRequest turns
 * APPROVED. The member lands at the end of the committee list with the
 * default "Member" designation, carrying the exact name / phone / photo
 * they submitted with the join form.
 *
 * Duplicate guard (explicit product rule): if the committee list ALREADY
 * contains a member with the same name OR the same phone number, the new
 * row is silently skipped — no duplicate cards in the public app.
 *
 * Phone matching is forgiving: digits-only, last 10 digits, so "+91 98xxx",
 * "9198xxx" and "098xxx" all collide with the bare 10-digit form.
 */

export type CommitteeSyncResult = 'added' | 'duplicate' | 'skipped'

/** digits-only fingerprint of a phone number (last 10 digits win) */
function phoneKey(p: unknown): string {
  const d = String(p || '').replace(/\D/g, '')
  return d.length > 10 ? d.slice(-10) : d
}

export async function syncApprovedMemberToCommittee(m: {
  name: string
  phone: string
  photoUrl?: string | null
}): Promise<CommitteeSyncResult> {
  const name = String(m.name || '').trim()
  const phone = String(m.phone || '').trim()
  const key = phoneKey(phone)

  // without a usable name + phone we cannot safely create a committee row
  if (!name || !key) return 'skipped'

  // check the WHOLE list (active + inactive) — an inactive twin must not
  // turn into a visible duplicate when reactivated later
  const existing = await db.committeeMember.findMany({
    select: { name: true, phone: true },
  })
  const lname = name.toLowerCase()
  const isDuplicate = existing.some((c) => {
    const cName = String(c.name || '').trim().toLowerCase()
    const cKey = phoneKey(c.phone)
    return (!!cName && cName === lname) || (!!cKey && cKey === key)
  })
  if (isDuplicate) return 'duplicate'

  const agg = await db.committeeMember.aggregate({ _max: { sortOrder: true } })
  await db.committeeMember.create({
    data: {
      name,
      role: 'Member',
      phone,
      photoUrl: m.photoUrl || '',
      sortOrder: (agg._max?.sortOrder ?? 0) + 1,
      active: true,
      phoneVisible: true, // master switch (hideCommitteePhone) still governs the public app
    },
  })
  return 'added'
}
