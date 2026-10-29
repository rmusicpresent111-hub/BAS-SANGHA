import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const [memberWaiting, memberApproved, memberRejected, tournamentWaiting, tournamentApproved, tournamentRejected, drawingWaiting, drawingApproved, drawingRejected, bloodWaiting, bloodApproved, bloodRejected, donPending, donSubmitted, donVerified, donRejected, donTotal, users, committee, banners, photos] = await Promise.all([
      db.memberRequest.count({ where: { status: 'WAITING' } }),
      db.memberRequest.count({ where: { status: 'APPROVED' } }),
      db.memberRequest.count({ where: { status: 'REJECTED' } }),
      db.tournamentRequest.count({ where: { status: 'WAITING' } }),
      db.tournamentRequest.count({ where: { status: 'APPROVED' } }),
      db.tournamentRequest.count({ where: { status: 'REJECTED' } }),
      db.drawingRequest.count({ where: { status: 'WAITING' } }),
      db.drawingRequest.count({ where: { status: 'APPROVED' } }),
      db.drawingRequest.count({ where: { status: 'REJECTED' } }),
      db.bloodRequest.count({ where: { status: 'WAITING' } }),
      db.bloodRequest.count({ where: { status: 'APPROVED' } }),
      db.bloodRequest.count({ where: { status: 'REJECTED' } }),
      db.donation.count({ where: { status: 'PENDING' } }),
      db.donation.count({ where: { status: 'SUBMITTED' } }),
      db.donation.count({ where: { status: 'VERIFIED' } }),
      db.donation.count({ where: { status: 'REJECTED' } }),
      db.donation.aggregate({ where: { status: 'VERIFIED' }, _sum: { amount: true } }),
      db.user.count(),
      db.committeeMember.count(),
      db.banner.count(),
      db.galleryPhoto.count(),
    ])
    return NextResponse.json({
      member: { waiting: memberWaiting, approved: memberApproved, rejected: memberRejected },
      tournament: { waiting: tournamentWaiting, approved: tournamentApproved, rejected: tournamentRejected },
      drawing: { waiting: drawingWaiting, approved: drawingApproved, rejected: drawingRejected },
      blood: { waiting: bloodWaiting, approved: bloodApproved, rejected: bloodRejected },
      donation: {
        pending: donPending,
        submitted: donSubmitted,
        verified: donVerified,
        rejected: donRejected,
        totalAmount: donTotal._sum.amount || 0,
      },
      users, committee, banners, photos,
    })
  } catch (e) {
    console.error('admin overview error', e)
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 })
  }
}
