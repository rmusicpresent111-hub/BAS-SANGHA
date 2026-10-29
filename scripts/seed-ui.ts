/** One-time seed for the redesigned home UI (Task 18). Safe to re-run. */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  /* ---- Quick actions (6 tiles) ---- */
  if ((await db.quickAction.count()) === 0) {
    await db.quickAction.createMany({
      data: [
        { label: 'পুজো কমিটি', icon: 'landmark', color: 'violet', link: 'committee', sortOrder: 1 },
        { label: 'খেলা টুর্নার্ন্ট', icon: 'volleyball', color: 'orange', link: 'events', sortOrder: 2 },
        { label: 'সদস্য তালিকা', icon: 'users', color: 'green', link: 'members', sortOrder: 3 },
        { label: 'নোটিশ', icon: 'file-text', color: 'sky', link: 'notice', sortOrder: 4 },
        { label: 'গ্যালারি', icon: 'image', color: 'rose', link: 'gallery', sortOrder: 5 },
        { label: 'যোগাযোগ', icon: 'headphones', color: 'purple', link: 'more', sortOrder: 6 },
      ],
    })
    console.log('seeded quick actions')
  }

  /* ---- Pujo highlight banner ---- */
  if ((await db.pujoHighlight.count()) === 0) {
    await db.pujoHighlight.create({
      data: {
        badge: 'সর্বজনীন',
        title: 'শ্রী শ্রী শ্যামা পুজা',
        subtitle: 'পরিচালনায় - ভৈরব আলো শ্যামা সংঘ',
        location: 'দক্ষিণ গোবিন্দপুর',
        dateText: 'পুজো শুরু: ৬ কার্তিক',
        imageUrl: '/images/kali-maa.png',
        detailImageUrl: '/images/pujo-donation-card.jpg',
      },
    })
    console.log('seeded pujo highlight')
  }

  /* ---- Notices ---- */
  if ((await db.notice.count()) === 0) {
    await db.notice.createMany({
      data: [
        {
          title: 'পুজো মণ্ডপ সাজসজ্জায় স্বেচ্ছাশ্রমিক দরকার',
          body: 'আগামী ১লা নভেম্বর সকাল ৯টা থেকে পুজো মণ্ডপের সাজসজ্জা শুরু হবে। যারা যুক্ত হতে চান কমিটির যেকোনো সদস্যের সাথে যোগাযোগ করুন। সবাই একসাথে হলেই পুজো হবে সুন্দর।',
        },
        {
          title: '২০২৬ সালের সাধারণ সদস্য ভর্তি চলছে',
          body: 'নতুন সদস্য ভর্তি চলছে। Member Join সেকশন থেকে ফর্ম পূরণ করে ফি জমা দিন। বিস্তারিত জানতে কমিটি অফিসে যোগাযোগ করুন।',
        },
      ],
    })
    console.log('seeded notices')
  }

  /* ---- Banner badge for football slide (like the reference) ---- */
  await db.banner.updateMany({ where: { title: 'Football Tournament 2025' }, data: { badge: 'খেলার স্মৃতি' } })

  /* ---- Header settings ---- */
  const settings: Record<string, string> = {
    headerTagline: 'Tradition · Culture · Community',
    headerQuote: 'একসাথে আমরা, একসাথে শক্তি',
    memberJoinSubtitle: 'আমাদের সাথে যুক্ত হোন',
  }
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
  }
  console.log('seeded settings')

  await db.$disconnect()
}

main()
