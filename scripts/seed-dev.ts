/**
 * Local dev seed — test users + events + receipt test entries.
 * Run: bunx tsx scripts/seed-dev.ts   (or bun scripts/seed-dev.ts)
 */
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const db = new PrismaClient()

function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  const now = new Date()

  await db.user.createMany({
    data: [
      { id: 'usr-admin-1', email: 'admin@bassangha.in', name: 'Admin', passwordHash: hashPassword('verify123'), role: 'ADMIN' },
      { id: 'usr-test-1', email: 'user@bassangha.in', name: 'Test User', passwordHash: hashPassword('verify123'), role: 'USER' },
    ],
  })

  await db.committeeMember.createMany({
    data: [
      { id: 'cm-test-1', name: 'টেস্ট সদস্য এক', role: 'সভাপতি', phone: '9000000001', photoUrl: '', sortOrder: 0, active: true, phoneVisible: false },
      { id: 'cm-test-2', name: 'টেস্ট সদস্য দুই', role: 'সম্পাদক', phone: '9000000002', photoUrl: '', sortOrder: 1, active: true, phoneVisible: true },
    ],
  })

  await db.event.createMany({
    data: [
      {
        id: 'ev-cricket', type: 'CRICKET', title: 'Cricket Tournament 2025', bannerUrl: '',
        description: 'দল নিয়ে যোগ দিন', eventDate: 'Date to be announced', venue: 'Dakshin Gobindapur',
        fee: 500, active: true, sortOrder: 1,
        rules: '১. প্রতি দলে ১১ জন খেলোয়াড়\n২. টেনিস বল দিয়ে খেলা হবে\n৩. আম্পায়ারের সিদ্ধান্ত চূড়ান্ত',
        formTitle: 'Team Registration', formNote: 'সঠিক তথ্য দিন',
        formFields: 'Captain Name *\nJersey Size\nTotal Players\nTeam Captain Phone *',
      },
      {
        id: 'ev-football', type: 'FOOTBALL', title: 'Football Tournament 2025', bannerUrl: '',
        description: 'দল নিয়ে যোগ দিন', eventDate: 'Date to be announced', venue: 'Dakshin Gobindapur',
        fee: 500, active: true, sortOrder: 2,
        rules: '১. প্রতি দলে ৭ জন খেলোয়াড়\n২. দুই হাফ ১৫ মিনিট',
        formTitle: 'Team Registration',
        formFields: 'Captain Name *\nTeam Captain Phone *',
      },
      {
        id: 'ev-drawing', type: 'DRAWING', title: 'Drawing Competition 2025', bannerUrl: '',
        description: 'শিশুদের আঁকার প্রতিযোগিতা', eventDate: 'Date to be announced', venue: 'Dakshin Gobindapur',
        fee: 30, active: true, sortOrder: 3,
        rules: '১. নিজের খাতায় আঁকতে হবে\n২. সময় ২ ঘণ্টা',
        formTitle: 'Entry Form',
        formFields: 'Participant Name *\nSchool Name *\nClass *',
      },
      {
        id: 'ev-blood', type: 'BLOOD', title: 'Blood Donation Camp 2025', bannerUrl: '',
        description: 'রক্তদান করুন', eventDate: 'Date to be announced', venue: 'Dakshin Gobindapur',
        fee: 0, active: true, sortOrder: 4, rules: '', formTitle: '', formFields: '',
      },
    ],
  })

  await db.drawingRequest.create({
    data: {
      id: 'dr-test-1', userId: 'usr-test-1', name: 'রাহুল দাস', fatherName: 'সুজিত দাস',
      className: 'V', schoolName: 'BAS High School', phone: '9876543210', fee: 30,
      utr: 'UTR123456789', paymentMethod: 'QR', docUrl: '', status: 'APPROVED',
    },
  })

  await db.tournamentRequest.create({
    data: {
      id: 'tr-test-1', userId: 'usr-test-1', type: 'CRICKET', teamName: 'শের-এ-বাংলা CC',
      address: 'Dakshin Gobindapur', phone: '9876543210', fee: 500,
      utr: 'UTR987654321', paymentMethod: 'QR', status: 'APPROVED',
    },
  })

  console.log('seeded:',
    await db.user.count(), 'users |',
    await db.committeeMember.count(), 'members |',
    await db.event.count(), 'events |',
    await db.drawingRequest.count(), 'drawing |',
    await db.tournamentRequest.count(), 'tournament')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
