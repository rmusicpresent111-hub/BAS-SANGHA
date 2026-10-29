import QRCode from 'qrcode'
import { db } from '@/lib/db'

/** UPI payee config from admin settings (falls back to the club's JioFinance VPA). */
export async function getUpiSettings(): Promise<{ upiId: string; upiName: string }> {
  const settings = await db.setting.findMany()
  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value
  return {
    upiId: map['upiId'] || '7908344580@jio',
    upiName: map['upiName'] || 'ARINDAM DAS',
  }
}

/**
 * Build a UPI intent URI (upi://pay?...) server-side.
 *
 * IMPORTANT encoding rules (this caused a real PhonePe bug):
 * - Must use %20 for spaces (encodeURIComponent), NOT URLSearchParams which
 *   emits '+'. PhonePe's strict parser treats '+'-encoded params as an
 *   untrusted/QR-like payment and covers the Pay button with a limit banner.
 * - No `tr` param: NPCI spec wants alphanumeric-only refs, and personal P2P
 *   pay links (what every personal QR contains) never carry `tr`. The order
 *   reference travels inside the `tn` note instead, so admin reconciliation
 *   via UTR + amount + order note is unaffected.
 *
 * Result is byte-equivalent to scanning the club's personal UPI QR — the
 * most battle-tested path in every UPI app.
 */
export function buildUpiIntent(opts: {
  upiId: string
  upiName: string
  amount: number
  note: string
}): string {
  const enc = encodeURIComponent
  const params = [
    `pa=${enc(opts.upiId)}`,
    `pn=${enc(opts.upiName)}`,
    `am=${enc(String(opts.amount))}`,
    'cu=INR',
    `tn=${enc(opts.note.slice(0, 40))}`,
  ]
  return `upi://pay?${params.join('&')}`
}

/**
 * Render a UPI intent as a QR PNG data-URL — the fallback payment method for
 * apps whose UPI Risk Policy blocks third-party deep links (Paytm shows
 * "Payment Alert … pay via mobile number or scanning their QR"). The QR
 * encodes the exact same server-built intent, so the amount is pre-filled
 * no matter which app scans it.
 */
export async function qrDataUrlFor(upiIntent: string): Promise<string> {
  return QRCode.toDataURL(upiIntent, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
}
