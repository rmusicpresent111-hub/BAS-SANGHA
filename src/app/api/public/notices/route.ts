import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** Full public list of active notices. */
export async function GET() {
  try {
    const notices = await db.notice.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ notices })
  } catch (e) {
    console.error('public notices error', e)
    return NextResponse.json({ error: 'Failed to load notices' }, { status: 500 })
  }
}
