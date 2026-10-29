import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

/**
 * GET /api/donation/mine — the caller's donations only (strict ownership
 * isolation: userId filter comes from the verified token, never from input).
 */
export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const donations = await db.donation.findMany({
      where: { userId: session.uid },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        amount: true,
        utr: true,
        status: true,
        payerName: true,
        payerPhone: true,
        note: true,
        createdAt: true,
      },
    })
    return NextResponse.json({ donations })
  } catch (e) {
    console.error('donation mine error', e)
    return NextResponse.json({ error: 'Failed to load donations' }, { status: 500 })
  }
}
