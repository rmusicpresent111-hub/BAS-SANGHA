/** Icon + color key maps shared by the QuickActions grid (home) and Admin panel. */
import {
  Bell,
  Droplet,
  FileText,
  HandCoins,
  Headphones,
  Heart,
  Image as ImageIcon,
  Landmark,
  Megaphone,
  Palette,
  Phone,
  Star,
  Trophy,
  Users,
  Volleyball,
  type LucideIcon,
} from 'lucide-react'

export const QA_ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  volleyball: Volleyball,
  users: Users,
  'file-text': FileText,
  image: ImageIcon,
  headphones: Headphones,
  trophy: Trophy,
  droplet: Droplet,
  palette: Palette,
  megaphone: Megaphone,
  heart: Heart,
  phone: Phone,
  star: Star,
  bell: Bell,
  handcoins: HandCoins,
}

export const QA_ICON_KEYS = Object.keys(QA_ICONS)

export interface QaColor {
  tile: string // pastel gradient for the tile background
  icon: string // solid gradient for the icon circle
}

export const QA_COLORS: Record<string, QaColor> = {
  violet: { tile: 'from-violet-100 to-violet-50', icon: 'from-violet-500 to-purple-600' },
  purple: { tile: 'from-purple-100 to-fuchsia-50', icon: 'from-purple-500 to-fuchsia-600' },
  orange: { tile: 'from-orange-100 to-amber-50', icon: 'from-orange-400 to-orange-600' },
  green: { tile: 'from-green-100 to-emerald-50', icon: 'from-green-500 to-emerald-600' },
  sky: { tile: 'from-sky-100 to-blue-50', icon: 'from-sky-400 to-blue-600' },
  rose: { tile: 'from-rose-100 to-pink-50', icon: 'from-rose-400 to-pink-600' },
  amber: { tile: 'from-amber-100 to-yellow-50', icon: 'from-amber-400 to-orange-500' },
  blue: { tile: 'from-blue-100 to-indigo-50', icon: 'from-blue-500 to-indigo-600' },
}

export const QA_COLOR_KEYS = Object.keys(QA_COLORS)

/** Where a quick action tile can navigate. */
export const QA_LINKS: { key: string; label: string }[] = [
  { key: 'committee', label: 'পুজো কমিটি সেকশন (scroll)' },
  { key: 'members', label: 'সদস্য তালিকা পেজ' },
  { key: 'events', label: 'ইভেন্টস পেজ' },
  { key: 'notice', label: 'নোটিশ পেজ' },
  { key: 'gallery', label: 'গ্যালারি' },
  { key: 'more', label: 'আরও / যোগাযোগ' },
  { key: 'member-join', label: 'Member Join ফর্ম' },
  { key: 'donation', label: 'Donate Now (UPI)' },
  { key: 'cricket', label: 'Cricket টুর্নামেন্ট' },
  { key: 'football', label: 'Football টুর্নামেন্ট' },
  { key: 'drawing', label: 'Drawing কম্পিটিশন' },
  { key: 'blood', label: 'Blood Donation' },
]
