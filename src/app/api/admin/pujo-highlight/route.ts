import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'

function deny() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  const highlights = await db.pujoHighlight.findMany({ orderBy: { active: 'desc' } })
  return NextResponse.json({ highlight: highlights[0] || null })
}

export async function PUT(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  try {
    const b = await req.json()
    const data: Record<string, unknown> = {}
    if (b.badge !== undefined) data.badge = String(b.badge).trim()
    if (b.title !== undefined) data.title = String(b.title).trim()
    if (b.subtitle !== undefined) data.subtitle = b.subtitle ? String(b.subtitle).trim() : null
    if (b.location !== undefined) data.location = b.location ? String(b.location).trim() : null
    if (b.dateText !== undefined) data.dateText = b.dateText ? String(b.dateText).trim() : null
    if (b.imageUrl !== undefined) data.imageUrl = String(b.imageUrl).trim()
    if (b.detailImageUrl !== undefined) data.detailImageUrl = b.detailImageUrl ? String(b.detailImageUrl).trim() : null
    if (b.active !== undefined) data.active = Boolean(b.active)

    const existing = await db.pujoHighlight.findFirst()
    const highlight = existing
      ? await db.pujoHighlight.update({ where: { id: existing.id }, data })
      : await db.pujoHighlight.create({
          data: { title: String(b.title || 'শ্রী শ্রী শ্যামা পুজা'), ...data },
        })
    return NextResponse.json({ highlight })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to save pujo highlight' }, { status: 500 })
  }
}
