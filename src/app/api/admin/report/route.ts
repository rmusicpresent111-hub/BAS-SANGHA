import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit, clientIp, pruneRateLimits } from '@/lib/rate-limit'
import { ensureDrawingColumns, ensurePaymentMethodColumns } from '@/lib/drawing-migrate'

function deny() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

type ReportType = 'donations' | 'member' | 'tournament' | 'drawing' | 'blood'

const LABELS: Record<ReportType, string> = {
  donations: 'Donations',
  member: 'Member-Requests',
  tournament: 'Tournament-Requests',
  drawing: 'Drawing-Entries',
  blood: 'Blood-Donors',
}

/** Escape a cell for CSV: quotes, commas, newlines. */
const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
const fmtDate = (d: Date) =>
  d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })

/** Row builders return the header + one array of cells per record. */
async function buildRows(type: ReportType, from: Date, to: Date) {
  const range = { createdAt: { gte: from, lte: to } }
  const pay = (m: string | null | undefined) => (String(m || 'QR').toUpperCase() === 'CASH' ? 'CASH' : 'QR/UPI')
  if (type === 'donations') {
    await ensurePaymentMethodColumns()
    const rows = await db.donation.findMany({ where: range, orderBy: { createdAt: 'desc' } })
    const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, email: true } })
    const umap = new Map(users.map((u) => [u.id, u]))
    const header = ['Order ID', 'Date', 'Amount (₹)', 'Status', 'Payment Method', 'Donor Account', 'Email', 'Payer Name', 'Phone', 'UTR', 'Note']
    return { header, rows: rows.map((d) => [d.orderId, fmtDate(d.createdAt), d.amount, d.status, pay(d.paymentMethod), umap.get(d.userId)?.name || '—', umap.get(d.userId)?.email || '—', d.payerName, d.payerPhone, d.utr || '—', d.note || '']) }
  }
  if (type === 'member') {
    await ensurePaymentMethodColumns()
    const rows = await db.memberRequest.findMany({ where: range, orderBy: { createdAt: 'desc' } })
    const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, email: true } })
    const umap = new Map(users.map((u) => [u.id, u]))
    const header = ['Date', 'Name', 'Age', "Father's Name", 'Address', 'Phone', 'Email', 'Member ID', 'Fee (₹)', 'Payment Method', 'UTR', 'Status', 'Note', 'Account', 'Account Email']
    return { header, rows: rows.map((r) => [fmtDate(r.createdAt), r.name, r.age, r.fatherName, r.address, r.phone, r.email, r.cardNumber || '—', r.fee, pay(r.paymentMethod), r.utr || '—', r.status, r.note || '', umap.get(r.userId)?.name || '—', umap.get(r.userId)?.email || '—']) }
  }
  if (type === 'tournament') {
    await ensurePaymentMethodColumns()
    const rows = await db.tournamentRequest.findMany({ where: range, orderBy: { createdAt: 'desc' } })
    const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, email: true } })
    const umap = new Map(users.map((u) => [u.id, u]))
    const header = ['Date', 'Team Name', 'Type', 'Address', 'Phone', 'Fee (₹)', 'Payment Method', 'UTR', 'Status', 'Note', 'Account', 'Account Email']
    return { header, rows: rows.map((r) => [fmtDate(r.createdAt), r.teamName, r.type, r.address, r.phone, r.fee, pay(r.paymentMethod), r.utr || '—', r.status, r.note || '', umap.get(r.userId)?.name || '—', umap.get(r.userId)?.email || '—']) }
  }
  if (type === 'drawing') {
    await ensureDrawingColumns()
    await ensurePaymentMethodColumns()
    const rows = await db.drawingRequest.findMany({ where: range, orderBy: { createdAt: 'desc' } })
    const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, email: true } })
    const umap = new Map(users.map((u) => [u.id, u]))
    const header = ['Date', 'Name', "Father's Name", 'Class', 'School', 'Mobile', 'Fee (₹)', 'Payment Method', 'UTR', 'Status', 'Note', 'Account', 'Account Email']
    return { header, rows: rows.map((r) => [fmtDate(r.createdAt), r.name, r.fatherName, r.className, r.schoolName, r.phone || '—', r.fee || 0, pay(r.paymentMethod), r.utr || '—', r.status, r.note || '', umap.get(r.userId)?.name || '—', umap.get(r.userId)?.email || '—']) }
  }
  const rows = await db.bloodRequest.findMany({ where: range, orderBy: { createdAt: 'desc' } })
  const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, email: true } })
  const umap = new Map(users.map((u) => [u.id, u]))
  const header = ['Date', 'Name', 'Address', 'Phone', 'Status', 'Note', 'Account', 'Account Email']
  return { header, rows: rows.map((r) => [fmtDate(r.createdAt), r.name, r.address, r.phone, r.status, r.note || '', umap.get(r.userId)?.name || '—', umap.get(r.userId)?.email || '—']) }
}

/**
 * GET /api/admin/report?type=donations|member|tournament|drawing|blood
 *                  &from=YYYY-MM-DD&to=YYYY-MM-DD   (both optional → all time)
 *
 * Streams a CSV file (UTF-8 BOM so Excel opens Bengali text correctly) of all
 * records created inside the chosen date range. ADMIN only.
 */
export async function GET(req: NextRequest) {
  const session = await getUser(req)
  if (session?.role !== 'ADMIN') return deny()
  if (!rateLimit(`report:${clientIp(req)}`, 20, 10 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  if (Math.random() < 0.05) pruneRateLimits()

  const sp = req.nextUrl.searchParams
  const type = (sp.get('type') || '') as ReportType
  if (!(type in LABELS)) return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })

  const parseDay = (s: string | null, endOfDay = false): Date | null => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
    const d = new Date(`${s}T00:00:00`)
    if (isNaN(d.getTime())) return null
    return endOfDay ? new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1) : d
  }
  const from = parseDay(sp.get('from')) ?? new Date(0)
  const to = parseDay(sp.get('to'), true) ?? new Date(9999, 11, 31, 23, 59, 59)

  try {
    const { header, rows } = await buildRows(type, from, to)
    // BOM makes Excel/Sheets detect UTF-8 (Bengali text renders correctly)
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
    const stamp = `${sp.get('from') || 'all'}_${sp.get('to') || 'time'}`
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="BAS-${LABELS[type]}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('report error', e)
    return NextResponse.json({ error: 'Failed to build report' }, { status: 500 })
  }
}
