/**
 * Shared sanitizer for the optional per-event custom form answers
 * ("extraData") submitted with blood / tournament / drawing requests.
 *
 * The admin defines extra form fields per event (Event.formFields — one
 * field label per line). The app answers them and submits a flat JSON
 * object { "label": "value" }. Labels come from the DB — not a fixed
 * list — so the payload is validated aggressively: flat object only,
 * max 10 fields, bounded label/value lengths, string values only.
 *
 * Returns the cleaned JSON string, or null when there is nothing valid.
 */
const MAX_FIELDS = 10
const MAX_LABEL = 80
const MAX_VALUE = 300

export function sanitizeExtraData(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null
  const entries = Object.entries(obj as Record<string, unknown>)
  if (entries.length > MAX_FIELDS) return null
  const clean: Record<string, string> = {}
  for (const [k, v] of entries) {
    const label = String(k).trim().slice(0, MAX_LABEL)
    const value = typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, MAX_VALUE) : ''
    if (!label || !value) continue
    clean[label] = value
  }
  if (!Object.keys(clean).length) return null
  return JSON.stringify(clean)
}

/** Parse a stored extraData JSON string into display rows (bad input -> []). */
export function extraDataRows(raw?: string | null): { label: string; value: string }[] {
  if (!raw) return []
  try {
    const obj = JSON.parse(raw)
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return []
    return Object.entries(obj)
      .filter(([k, v]) => String(k).trim() && String(v ?? '').trim())
      .map(([k, v]) => ({ label: String(k).trim(), value: String(v).trim() }))
  } catch {
    return []
  }
}
