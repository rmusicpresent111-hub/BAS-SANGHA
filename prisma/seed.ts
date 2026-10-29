/**
 * Seed script for B.A.S Sangha app.
 * Run: bun prisma/seed.ts
 *
 * Security audit: NO hardcoded credentials anymore. Passwords/reset codes are
 * read from env vars when provided, otherwise generated randomly and printed
 * ONCE. Previously committed defaults (admin123 / demo123 / BAS2021) have
 * been rotated — see SECURITY.md.
 */
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const db = new PrismaClient()

function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function randomPassword(): string {
  return crypto.randomBytes(9).toString('base64url') // ~12 chars, URL-safe
}

async function main() {
  console.log('Seeding B.A.S Sangha...')

  // ---- Users ----
  const adminEmail = 'admin@bassangha.in'
  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } })
  if (!existingAdmin) {
    const pw = process.env.SEED_ADMIN_PASSWORD || randomPassword()
    await db.user.create({
      data: {
        name: 'Admin',
        email: adminEmail,
        passwordHash: hashPassword(pw),
        role: 'ADMIN',
      },
    })
    console.log(`✓ Admin user created (${adminEmail} / ${pw}) — save it now, it is NOT shown again`)
  } else {
    console.log('• Admin user exists')
  }

  const demoEmail = 'demo@bassangha.in'
  const existingDemo = await db.user.findUnique({ where: { email: demoEmail } })
  if (!existingDemo) {
    const pw = process.env.SEED_DEMO_PASSWORD || randomPassword()
    await db.user.create({
      data: {
        name: 'Demo Member',
        email: demoEmail,
        passwordHash: hashPassword(pw),
        role: 'USER',
      },
    })
    console.log(`✓ Demo user created (${demoEmail} / ${pw})`)
  }

  // ---- Banners ----
  const bannerCount = await db.banner.count()
  if (bannerCount === 0) {
    await db.banner.createMany({
      data: [
        { title: 'Football Tournament 2025', subtitle: 'Dekchin Gobindapur B.A.S Sangha presents', imageUrl: '/images/banner-football.png', sortOrder: 1 },
        { title: 'Cricket Tournament 2025', subtitle: 'Champions are made on the field', imageUrl: '/images/banner-cricket.png', sortOrder: 2 },
        { title: 'Drawing Competition 2025', subtitle: 'Let the little hands paint their dreams', imageUrl: '/images/banner-drawing.png', sortOrder: 3 },
        { title: 'Blood Donation Camp 2025', subtitle: 'Donate blood, save a life', imageUrl: '/images/banner-blood.png', sortOrder: 4 },
      ],
    })
    console.log('✓ Banners created')
  } else {
    console.log('• Banners exist')
  }

  // ---- Committee Members ----
  const memberCount = await db.committeeMember.count()
  if (memberCount === 0) {
    await db.committeeMember.createMany({
      data: [
        { name: 'Sourav Pramanik', role: 'President', phone: '9876543210', photoUrl: '/images/member-1.png', sortOrder: 1 },
        { name: 'Haripada Bhattacharya', role: 'Vice President', phone: '9876543211', photoUrl: '/images/member-2.png', sortOrder: 2 },
        { name: 'Rupsa Mondal', role: 'Secretary', phone: '9876543212', photoUrl: '/images/member-3.png', sortOrder: 3 },
        { name: 'Bapan Sardar', role: 'Treasurer', phone: '9876543213', photoUrl: '/images/member-4.png', sortOrder: 4 },
        { name: 'Anita Ghosh', role: 'Cultural Head', phone: '9876543214', photoUrl: '/images/member-5.png', sortOrder: 5 },
        { name: 'Prakash Nandi', role: 'Sports Head', phone: '9876543215', photoUrl: '/images/member-6.png', sortOrder: 6 },
      ],
    })
    console.log('✓ Committee members created')
  } else {
    console.log('• Committee members exist')
  }

  // ---- Events ----
  const eventTypes = ['CRICKET', 'FOOTBALL', 'DRAWING', 'BLOOD']
  const existingEvents = await db.event.findMany()
  const existingTypes = new Set(existingEvents.map((e) => e.type))

  const eventsToCreate = [
    { type: 'FOOTBALL', title: 'Football Tournament 2025', bannerUrl: '/images/banner-football.png', eventDate: '12th January 2025, 4:00 PM onwards', venue: 'Dekchin Gobindapur Playground', fee: 1000, description: 'Open to all village clubs. 11-a-side knock-out format. Winner prize ₹11,000 & Runner-up ₹5,000.', sortOrder: 1 },
    { type: 'CRICKET', title: 'Cricket Tournament 2025', bannerUrl: '/images/banner-cricket.png', eventDate: '26th January 2025, 8:00 AM onwards', venue: 'Dekchin Gobindapur Cricket Ground', fee: 1200, description: '8-over night cricket. Maximum 12 players per team. Winner prize ₹15,000 & Man of the Series special award.', sortOrder: 2 },
    { type: 'DRAWING', title: 'Drawing Competition 2025', bannerUrl: '/images/banner-drawing.png', eventDate: '2nd February 2025, 10:00 AM', venue: 'B.A.S Sangha Community Hall', fee: 0, description: 'Group A: Class I-IV, Group B: Class V-VIII, Group C: Class IX-XII. All drawing materials will be provided.', sortOrder: 3 },
    { type: 'BLOOD', title: 'Blood Donation Camp 2025', bannerUrl: '/images/banner-blood.png', eventDate: '23rd February 2025, 9:00 AM - 4:00 PM', venue: 'B.A.S Sangha Community Hall', fee: 0, description: 'In collaboration with Blood Bank. Free health check-up for every donor. Refreshments & certificate for all donors.', sortOrder: 4 },
  ]

  for (const ev of eventsToCreate) {
    if (!existingTypes.has(ev.type)) {
      await db.event.create({ data: ev })
      console.log(`✓ Event created: ${ev.type}`)
    }
  }

  // ---- Gallery ----
  const photoCount = await db.galleryPhoto.count()
  if (photoCount === 0) {
    await db.galleryPhoto.createMany({
      data: [
        { year: '2023', caption: 'Annual Sports Day - Trophy Ceremony', imageUrl: '/images/event-1.png' },
        { year: '2023', caption: 'Cultural Night Performance', imageUrl: '/images/event-2.png' },
        { year: '2023', caption: 'Blood Donation Camp 2023', imageUrl: '/images/event-3.png' },
        { year: '2022', caption: 'Drawing Competition Prize Distribution', imageUrl: '/images/event-4.png' },
        { year: '2022', caption: 'Football Champions 2022', imageUrl: '/images/event-5.png' },
        { year: '2021', caption: 'Foundation Day & General Meeting', imageUrl: '/images/event-6.png' },
        { year: '2021', caption: 'Our First Cultural Programme', imageUrl: '/images/event-2.png' },
      ],
    })
    console.log('✓ Gallery photos created')
  } else {
    console.log('• Gallery photos exist')
  }

  // ---- Settings ----
  const settings: Record<string, string> = {
    memberFee: '1500',
    upiId: '7908344580@jio',
    upiName: 'ARINDAM DAS',
    clubAddress: 'Dekchin Gobindapur, West Bengal',
    // admin password-reset secret — changeable in Admin Panel → Settings
    resetCode: process.env.SEED_RESET_CODE || crypto.randomBytes(6).toString('hex').toUpperCase(),
  }
  for (const [key, value] of Object.entries(settings)) {
    const existing = await db.setting.findUnique({ where: { key } })
    if (!existing) {
      await db.setting.create({ data: { key, value } })
      console.log(`✓ Setting created: ${key}`)
    }
  }

  console.log('Seed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
