import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'
import { ensureDrawingColumns, ensurePaymentMethodColumns } from '@/lib/drawing-migrate'
import { ensureFormColumns } from '@/lib/form-migrate'

function deny() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export interface SummaryRow {
  id: string
  date: string // ISO
  name: string
  amount: number // 0 for non-money services (blood)
  method: 'CASH' | 'ONLINE'
  status: string
}

export interface SummaryService {
  key: 'donations' | 'member' | 'tournament' | 'drawing' | 'blood'
  label: string // Bengali label for the PDF
  money: boolean
  rows: SummaryRow[]
  cashCount: number
  onlineCount: number
  cashTotal: number
  onlineTotal: number
  total: number
  count: number
}

/**
 * GET /api/admin/report/summary?from=YYYY-MM-DD&to=YYYY-MM-DD (both optional)
 *
 * Powers the admin "Reports" tab + PDF download. Returns, per service, every
 * APPROVED / VERIFIED record inside the date range with its payment method,
 * plus cash / online subtotals, per-service totals and a grand total.
 * Only approved money counts — pending/rejected entries never appear.
 */
export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  if (!rateLimit(`rsum:${clientIp(req)}`, 30, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()

  const sp = req.nextUrl.searchParams
  const parseDay = (s: string | null, endOfDay = false): Date | null => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
    const d = new Date(`${s}T00:00:00`)
    if (isNaN(d.getTime())) return null
    return endOfDay ? new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1) : d
  }
  const from = parseDay(sp.get('from')) ?? new Date(0)
  const to = parseDay(sp.get('to'), true) ?? new Date(9999, 11, 31, 23, 59, 59)
  const range = { createdAt: { gte: from, lte: to } }
  const methodOf = (m: string | null | undefined): 'CASH' | 'ONLINE' =>
    String(m || 'QR').toUpperCase() === 'CASH' ? 'CASH' : 'ONLINE'

  try {
    await ensurePaymentMethodColumns()
    await ensureDrawingColumns()
    await ensureFormColumns()

    const [donations, members, tournaments, drawings, blood] = await Promise.all([
      db.donation.findMany({ where: { ...range, status: 'VERIFIED' }, orderBy: { createdAt: 'desc' } }),
      db.memberRequest.findMany({ where: { ...range, status: 'APPROVED' }, orderBy: { createdAt: 'desc' } }),
      db.tournamentRequest.findMany({ where: { ...range, status: 'APPROVED' }, orderBy: { createdAt: 'desc' } }),
      db.drawingRequest.findMany({ where: { ...range, status: 'APPROVED' }, orderBy: { createdAt: 'desc' } }),
      db.bloodRequest.findMany({ where: { ...range, status: 'APPROVED' }, orderBy: { createdAt: 'desc' } }),
    ])

    const build = (
      key: SummaryService['key'],
      label: string,
      money: boolean,
      raw: { id: string; createdAt: Date; name: string; amount: number; method: 'CASH' | 'ONLINE'; status: string }[]
    ): SummaryService => {
      const rows: SummaryRow[] = raw
        .map((r) => ({
          id: r.id,
          date: r.createdAt.toISOString(),
          name: r.name,
          amount: money ? r.amount : 0,
          method: r.method,
          status: r.status,
        }))
        // date-by-date view inside each service: newest first
        .sort((a, b) => (a.date < b.date ? 1 : -1))
      const cashTotal = rows.filter((r) => r.method === 'CASH').reduce((s, r) => s + r.amount, 0)
      const onlineTotal = rows.filter((r) => r.method === 'ONLINE').reduce((s, r) => s + r.amount, 0)
      return {
        key,
        label,
        money,
        rows,
        cashCount: rows.filter((r) => r.method === 'CASH').length,
        onlineCount: rows.filter((r) => r.method === 'ONLINE').length,
        cashTotal,
        onlineTotal,
        total: cashTotal + onlineTotal,
        count: rows.length,
      }
    }

    const services: SummaryService[] = [
      build('donations', 'Donation (সাহায্য)', true, donations.map((d) => ({
        id: d.orderId, createdAt: d.createdAt, name: d.payerName || 'Donor', amount: d.amount, method: methodOf(d.paymentMethod), status: d.status,
      }))),
      build('member', 'Member Join (সদস্য ফি)', true, members.map((r) => ({
        id: r.cardNumber || r.id, createdAt: r.createdAt, name: r.name, amount: r.fee, method: methodOf(r.paymentMethod), status: r.status,
      }))),
      build('tournament', 'Tournament (খেলা ফি)', true, tournaments.map((r) => ({
        id: r.id, createdAt: r.createdAt, name: `${r.teamName} (${r.type})`, amount: r.fee, method: methodOf(r.paymentMethod), status: r.status,
      }))),
      build('drawing', 'Drawing (এন্ট্রি ফি)', true, drawings.map((r) => ({
        id: r.id, createdAt: r.createdAt, name: r.name, amount: r.fee || 0, method: methodOf(r.paymentMethod), status: r.status,
      }))),
      build('blood', 'Blood Donor (রক্তদান — ফি নেই)', false, blood.map((r) => ({
        id: r.id, createdAt: r.createdAt, name: r.name, amount: 0, method: 'ONLINE' as const, status: r.status,
      }))),
    ]

    const grand = services.reduce(
      (acc, s) => ({
        cashTotal: acc.cashTotal + s.cashTotal,
        onlineTotal: acc.onlineTotal + s.onlineTotal,
        cashCount: acc.cashCount + s.cashCount,
        onlineCount: acc.onlineCount + s.onlineCount,
        count: acc.count + s.count,
      }),
      { cashTotal: 0, onlineTotal: 0, cashCount: 0, onlineCount: 0, count: 0 }
    )

    return NextResponse.json({
      from: sp.get('from') || '',
      to: sp.get('to') || '',
      services,
      grand: { ...grand, total: grand.cashTotal + grand.onlineTotal },
    })
  } catch (e) {
    console.error('report summary error', e)
    return NextResponse.json({ error: 'Failed to build report summary' }, { status: 500 })
  }
}
