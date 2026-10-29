export interface BannerDto {
  id: string
  title: string
  subtitle?: string | null
  badge?: string | null
  imageUrl: string
  objectFit?: string | null
  sortOrder: number
  active: boolean
}

export interface QuickActionDto {
  id: string
  label: string
  icon: string
  color: string
  link: string
  sortOrder: number
  active: boolean
}

export interface PujoHighlightDto {
  id: string
  badge: string
  title: string
  subtitle?: string | null
  location?: string | null
  dateText?: string | null
  imageUrl: string
  detailImageUrl?: string | null
  active: boolean
}

export interface NoticeDto {
  id: string
  title: string
  body: string
  createdAt: string
  active: boolean
}

export interface MemberDto {
  id: string
  name: string
  role: string
  phone: string
  photoUrl: string
  sortOrder: number
  active: boolean
}

export type EventType = 'CRICKET' | 'FOOTBALL' | 'DRAWING' | 'BLOOD'

export interface EventDto {
  id: string
  type: EventType
  title: string
  bannerUrl: string
  description?: string | null
  eventDate?: string | null
  venue?: string | null
  fee: number
  active: boolean
  sortOrder: number
}

export interface HomeData {
  banners: BannerDto[]
  members: MemberDto[]
  events: EventDto[]
  settings: Record<string, string>
  quickActions: QuickActionDto[]
  highlight: PujoHighlightDto | null
  notices: NoticeDto[]
}

export interface GalleryPhotoDto {
  id: string
  year: string
  caption?: string | null
  imageUrl: string
}

export interface GalleryData {
  years: { year: string; photos: GalleryPhotoDto[] }[]
}

export type ReqStatus = 'WAITING' | 'APPROVED' | 'REJECTED'

export interface MemberRequestDto {
  id: string
  userId: string
  name: string
  age: string
  fatherName: string
  address: string
  phone: string
  email: string
  photoUrl?: string | null
  cardNumber?: string | null
  fee: number
  utr: string
  status: ReqStatus
  note?: string | null
  createdAt: string
}

export interface TournamentRequestDto {
  id: string
  userId: string
  type: 'CRICKET' | 'FOOTBALL'
  teamName: string
  address: string
  phone: string
  fee: number
  utr: string
  status: ReqStatus
  note?: string | null
  createdAt: string
}

export interface DrawingRequestDto {
  id: string
  userId: string
  name: string
  fatherName: string
  className: string
  schoolName: string
  docUrl: string
  status: ReqStatus
  note?: string | null
  createdAt: string
}

export interface BloodRequestDto {
  id: string
  userId: string
  name: string
  address: string
  phone: string
  status: ReqStatus
  note?: string | null
  createdAt: string
}
