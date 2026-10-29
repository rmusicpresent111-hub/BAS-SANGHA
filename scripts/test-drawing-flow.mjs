/**
 * E2E test for the new Drawing entry flow:
 * form(+mobile) → UNPAID → pay UTR → WAITING → admin approve → APPROVED (+receipt data)
 * Also covers: 10-digit validation, discard UNPAID, UTR reuse guard.
 */
const BASE = 'http://localhost:3000'
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

const api = async (path, opts = {}, token) => {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  let data = {}
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

async function signup(name, email, pass_) {
  const r = await api('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: pass_ }),
  })
  if (r.status === 200 || r.status === 201) return r.data.token || r.data.accessToken
  const l = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass_ }),
  })
  return l.data.token
}

async function main() {
  const stamp = Date.now().toString().slice(-6)

  // --- find admin (existing local admin) ---
  let adminToken = null
  const adminLogins = [
    ['admin@test.local', 'admintest123'],
    ['admin@bas.com', 'admin123'],
    ['admin@bassangha.in', 'admin1234'],
  ]
  for (const [email, pw] of adminLogins) {
    const l = await api('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw }),
    })
    if (l.status === 200 && l.data.token) { adminToken = l.data.token; console.log(`admin login: ${email}`); break }
  }
  if (!adminToken) { console.log('⚠️ no admin found — creating one via db skip; tests need admin'); }
  else {
    const me = await api('/api/auth/me', {}, adminToken)
    ok(me.data?.user?.role === 'ADMIN', 'admin role verified')
  }

  // --- user 1: full happy path ---
  console.log('\n— User 1: happy path —')
  const u1 = await signup(`Draw Test ${stamp}`, `draw${stamp}@test.com`, 'test1234')
  ok(!!u1, 'user1 signup/login')
  const png = new Blob([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')], { type: 'image/png' })
  const formBody = (phone) => {
    const fd = new FormData()
    fd.set('name', 'Test Kid')
    fd.set('fatherName', 'Test Father')
    fd.set('className', 'Class IV')
    fd.set('schoolName', 'Test School')
    fd.set('phone', phone)
    fd.set('doc', png, 'a.png')
    return fd
  }
  const postForm = (path, fd, token) =>
    fetch(`${BASE}${path}`, { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(async (res) => ({
      status: res.status,
      data: await res.json().catch(() => ({})),
    }))

  // invalid phone rejected
  let r = await postForm('/api/drawing-request', formBody('12345'), u1)
  ok(r.status === 400, 'invalid phone rejected (400)', JSON.stringify(r.data))

  // valid submit → UNPAID with fee 30
  r = await postForm('/api/drawing-request', formBody('9876543210'), u1)
  ok(r.status === 200 && r.data.request?.status === 'UNPAID', 'submit → UNPAID', JSON.stringify(r.data))
  ok(r.data.request?.phone === '9876543210', 'mobile number saved')
  ok(r.data.request?.fee === 30, 'fee snapshot = 30', `got ${r.data.request?.fee}`)

  // pay: bad UTR format
  r = await api('/api/drawing-request/pay', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ utr: 'short' }),
  }, u1)
  ok(r.status === 400, 'bad UTR format rejected (400)')

  const UTR = `UTR${stamp}XY9`
  r = await api('/api/drawing-request/pay', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ utr: UTR.toLowerCase() }),
  }, u1)
  ok(r.status === 200 && r.data.request?.status === 'WAITING', 'pay UTR → WAITING', JSON.stringify(r.data))
  ok(r.data.request?.utr === UTR.toUpperCase(), 'UTR stored uppercase')

  // admin sees phone + utr
  r = await api('/api/admin/requests?tab=drawing', {}, adminToken)
  const row = (r.data.requests || []).find((x) => x.phone === '9876543210')
  ok(!!row, 'admin sees drawing entry with mobile')
  ok(row?.utr === UTR.toUpperCase(), 'admin sees UTR')
  if (!row) throw new Error('no drawing row — aborting')

  // approve
  r = await api('/api/admin/requests', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab: 'drawing', id: row.id, status: 'APPROVED', note: '' }),
  }, adminToken)
  ok(r.status === 200 && r.data.request?.status === 'APPROVED', 'admin approve → APPROVED')

  // user sees APPROVED + utr (receipt renders from this)
  r = await api('/api/drawing-request', {}, u1)
  ok(r.data.request?.status === 'APPROVED' && r.data.request?.utr === UTR.toUpperCase(), 'user sees APPROVED + receipt data (UTR)')

  // --- user 2: discard unpaid + UTR reuse guard ---
  console.log('\n— User 2: discard + UTR guard —')
  const u2 = await signup(`Draw Two ${stamp}`, `draw2_${stamp}@test.com`, 'test1234')
  ok(!!u2, 'user2 signup/login')
  r = await postForm('/api/drawing-request', formBody('9999888877'), u2)
  ok(r.status === 200 && r.data.request?.status === 'UNPAID', 'user2 submit → UNPAID')

  // reuse user1's UTR → must 409
  r = await api('/api/drawing-request/pay', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ utr: UTR.toUpperCase() }),
  }, u2)
  ok(r.status === 409, 'UTR reuse blocked (409)', JSON.stringify(r.data))

  // discard unpaid entry
  r = await api('/api/drawing-request', { method: 'DELETE' }, u2)
  ok(r.status === 200 && r.data.ok === true, 'discard UNPAID entry ok')
  r = await api('/api/drawing-request', {}, u2)
  ok(r.data.request === null, 'after discard, no entry')

  // report includes mobile columns
  {
    const res = await fetch(`${BASE}/api/admin/report?type=drawing`, { headers: { Authorization: `Bearer ${adminToken}` } })
    const csv = await res.text()
    ok(res.status === 200 && csv.includes('Mobile') && csv.includes('Fee') && csv.includes('UTR'), 'report CSV has Mobile/Fee/UTR columns')
  }

  console.log(`\n========== RESULT: ${pass} passed, ${fail} failed ==========`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('test crashed:', e); process.exit(1) })
