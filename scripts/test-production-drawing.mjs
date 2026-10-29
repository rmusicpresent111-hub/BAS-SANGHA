/**
 * Production smoke test for the new drawing flow (incl. runtime migration).
 * Creates a temp user, submits the drawing form (triggers ensureDrawingColumns
 * on Turso), checks UNPAID → discards. Leaves the temp user account behind.
 */
const BASE = 'https://bas-sangha.vercel.app'
const stamp = Date.now().toString().slice(-8)
let pass = 0, fail = 0
const ok = (c, n, x = '') => (c ? (pass++, console.log('  ✅ ' + n)) : (fail++, console.log('  ❌ ' + n + ' ' + x)))

const j = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, opts)
  let data = {}
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

const signup = async () => {
  const email = `prodcheck${stamp}@testmail.com`
  let r = await j('/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Prod Check', email, password: 'check1234' }),
  })
  if (r.status !== 200 && r.status !== 201)
    r = await j('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'check1234' }),
    })
  return r.data.token
}

const t = await signup()
ok(!!t, 'temp user ready on production')

const fd = new FormData()
fd.set('name', 'Prod Check Kid')
fd.set('fatherName', 'Prod Check Father')
fd.set('className', 'Class II')
fd.set('schoolName', 'Prod Check School')
fd.set('phone', '9000000000')
fd.set('doc', new Blob([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')], { type: 'image/png' }), 'a.png')

let r = await fetch(`${BASE}/api/drawing-request`, {
  method: 'POST', body: fd, headers: { Authorization: `Bearer ${t}` },
})
const data = await r.json().catch(() => ({}))
ok(r.status === 200 && data.request?.status === 'UNPAID', 'form submit → UNPAID (migration ran)', JSON.stringify(data))
ok(data.request?.fee === 30, 'fee = 30', `got ${data.request?.fee}`)
ok(data.request?.phone === '9000000000', 'mobile saved')

r = await fetch(`${BASE}/api/drawing-request`, { headers: { Authorization: `Bearer ${t}` } })
const g = await r.json().catch(() => ({}))
ok(g.request?.status === 'UNPAID', 'GET shows UNPAID')

// bad UTR must be rejected (pay route reachable)
r = await fetch(`${BASE}/api/drawing-request/pay`, {
  method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ utr: 'bad' }),
})
ok(r.status === 400, 'pay rejects bad UTR format (400)')

// discard the test entry so the club's data stays clean
r = await fetch(`${BASE}/api/drawing-request`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } })
ok(r.status === 200, 'test entry discarded')

console.log(`\n===== PRODUCTION: ${pass} passed, ${fail} failed =====`)
process.exit(fail ? 1 : 0)
