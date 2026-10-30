'use client'

import { ClipboardList } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { extraDataRows } from '@/lib/extra-data'

export { extraDataRows }

/**
 * Shared pieces for the admin-configurable event rules + custom form fields.
 *
 * The admin edits (per event, in the Admin Panel → Events tab):
 *   - rules      -> নিয়মাবলী text, one rule per line, shown as numbered bullets
 *   - formTitle  -> custom form heading (falls back to the screen default)
 *   - formNote   -> custom helper note inside the form
 *   - formFields -> extra form fields, one label per line, trailing * = required
 *
 * The user screens render these and submit the answers as a flat JSON
 * object (extraData) alongside the standard fields.
 */

export interface ExtraField {
  label: string
  required: boolean
}

export type RulesTone = 'red' | 'amber' | 'blue'

/** Parse the admin-entered "one field label per line" text. '*' suffix = required. */
export function parseFormFields(text?: string | null): ExtraField[] {
  if (!text) return []
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((line) => {
      const required = line.endsWith('*')
      const label = (required ? line.slice(0, -1) : line).trim()
      return { label, required }
    })
    .filter((f) => f.label)
}

/** Validate required extra fields + serialize the answers for submission. */
export function buildExtraPayload(
  fields: ExtraField[],
  values: Record<string, string>
): { ok: true; data: string | null } | { ok: false; missing: string } {
  const out: Record<string, string> = {}
  for (const f of fields) {
    const v = (values[f.label] || '').trim()
    if (f.required && !v) return { ok: false, missing: f.label }
    if (v) out[f.label] = v.slice(0, 300)
  }
  return { ok: true, data: Object.keys(out).length ? JSON.stringify(out) : null }
}

/** Parse a stored extraData JSON string into display rows (bad input -> []). */
// extraDataRows lives in @/lib/extra-data (shared with server routes) and is re-exported above.

const RULE_TONES: Record<RulesTone, { wrap: string; title: string; num: string; icon: string }> = {
  red: {
    wrap: 'border-red-200 bg-white',
    title: 'text-red-900',
    num: 'bg-red-100 text-red-700',
    icon: 'text-red-600',
  },
  amber: {
    wrap: 'border-amber-200 bg-white',
    title: 'text-stone-800',
    num: 'bg-amber-100 text-amber-700',
    icon: 'text-amber-600',
  },
  blue: {
    wrap: 'border-blue-100 bg-white',
    title: 'text-stone-800',
    num: 'bg-blue-50 text-blue-900',
    icon: 'text-blue-800',
  },
}

/** নিয়মাবলী section — numbered bullets, one per line of the admin text. */
export function RulesSection({ text, tone = 'blue' }: { text?: string | null; tone?: RulesTone }) {
  const rules = (text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!rules.length) return null
  const t = RULE_TONES[tone]
  return (
    <section aria-label="Rules" className={`relative z-10 rounded-2xl border ${t.wrap} p-5 shadow-sm`}>
      <h3 className={`flex items-center gap-1.5 text-sm font-black ${t.title}`}>
        <ClipboardList className={`h-4 w-4 ${t.icon}`} /> নিয়মাবলী
      </h3>
      <ol className="mt-3 space-y-2">
        {rules.map((r, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${t.num}`}>
              {i + 1}
            </span>
            <span className="text-[13px] leading-relaxed text-stone-700">{r}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The admin-defined extra inputs, rendered below the standard form fields. */
export function ExtraFields({
  fields,
  values,
  onChange,
}: {
  fields: ExtraField[]
  values: Record<string, string>
  onChange: (label: string, value: string) => void
}) {
  if (!fields.length) return null
  return (
    <>
      {fields.map((f) => (
        <div className="space-y-1.5" key={f.label}>
          <Label>
            {f.label}
            {f.required ? ' *' : ''}
          </Label>
          <Input
            value={values[f.label] || ''}
            onChange={(e) => onChange(f.label, e.target.value)}
            placeholder={`${f.label} লিখুন`}
            maxLength={300}
          />
        </div>
      ))}
    </>
  )
}
