/* Quick e2e check of the new QR/CASH payment flows against the local dev server. */
const BASE = 'http://localhost:3000'

async function j(method, path, body, token, isForm) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !isForm) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

const rnd = Math.floor(Math.random() * 900000 + 100000)
const EMAIL = `cashtest${rnd}@test.com`
const PASS = 'cashtest123'
let failures = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) failures++
}

// 1. signup a fresh user
let r = await j('POST', '/api/auth/signup', { name: 'Cash Test', email: EMAIL, password: PASS })
const userToken = r.data?.token
ok('signup', r.status === 200 || r.status === 201, `status=${r.status}`)

// 2. CASH donation → SUBMITTED with no UTR
r = await j('POST', '/api/donation/order', { amount: 100, paymentMethod: 'CASH' }, userToken)
ok('cash donation order → SUBMITTED', r.data?.donation?.status === 'SUBMITTED' && r.data?.donation?.paymentMethod === 'CASH', `status=${r.data?.donation?.status}`)
const cashOrderId = r.data?.donation?.orderId

// 3. QR donation order → PENDING (existing path intact)
r = await j('POST', '/api/donation/order', { amount: 50 }, userToken)
ok('qr donation order → PENDING', r.data?.donation?.status === 'PENDING', `status=${r.data?.donation?.status}`)

// 4. admin login
r = await j('POST', '/api/auth/login', { email: 'admin@test.local', password: 'admintest123' })
const adminToken = r.data?.token
ok('admin login', !!adminToken)

// 5. admin verifies the cash donation
r = await j('GET', '/api/admin/donations', null, adminToken)
const cashDon = (r.data?.donations || []).find((d) => d.orderId === cashOrderId)
ok('admin sees CASH chip data', cashDon && cashDon.paymentMethod === 'CASH')
r = await j('PUT', '/api/admin/donations', { id: cashDon.id, status: 'VERIFIED' }, adminToken)
ok('admin verifies cash donation', r.status === 200 && r.data?.donation?.status === 'VERIFIED')

// 6. member join with CASH (multipart, no UTR)
let fd = new FormData()
fd.set('name', 'Cash Member')
fd.set('address', 'Dakshin Gobindapur')
fd.set('phone', '9876543210')
fd.set('paymentMethod', 'CASH')
r = await j('POST', '/api/member-request', fd, userToken, true)
ok('member cash submit → WAITING, empty utr', r.status === 200 && r.data?.request?.paymentMethod === 'CASH' && r.data?.request?.utr === '', `status=${r.status} err=${r.data?.error || ''}`)

// 7. summary report shows the verified cash donation under CASH
r = await j('GET', '/api/admin/report/summary', null, adminToken)
const donSvc = (r.data?.services || []).find((s) => s.key === 'donations')
ok('summary: cash total ₹100', donSvc?.cashTotal === 100, `cashTotal=${donSvc?.cashTotal}`)
ok('summary: grand total includes it', r.data?.grand?.total >= 100, `total=${r.data?.grand?.total}`)

// 8. non-admin cannot access summary
r = await j('GET', '/api/admin/report/summary', null, userToken)
ok('summary blocked for non-admin', r.status === 403)

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures ? 1 : 0)
