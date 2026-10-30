/* eslint-disable @typescript-eslint/no-require-imports */
// Re-set GitHub Actions secrets (repo: rmusicpresent111-hub/BAS-SANGHA)
// Usage: bun run scripts/reset-actions-secrets.cjs <TOKEN>
const _sodium = require('libsodium-wrappers-sumo')

const TOKEN = process.argv[2]
if (!TOKEN) { console.error('need token arg'); process.exit(1) }
const REPO = 'rmusicpresent111-hub/BAS-SANGHA'

const secrets = {
  ANDROID_KEYSTORE_PASSWORD: 'cC8YQWp6aiPjxYpEUYaK',
  ANDROID_KEY_ALIAS: 'bassangha',
  ANDROID_KEY_PASSWORD: 'cC8YQWp6aiPjxYpEUYaK',
}

const api = async (path, opts = {}) =>
  fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })

async function main() {
  await _sodium.ready
  const { crypto_box_seal } = _sodium
  const b64 = (u) => Buffer.from(u).toString('base64')

  const pkRes = await api(`/repos/${REPO}/actions/secrets/public-key`)
  if (!pkRes.ok) { console.error('public-key failed:', pkRes.status, await pkRes.text()); process.exit(1) }
  const { key_id, key } = await pkRes.json()
  console.log('repo public key fetched, key_id:', key_id)

  for (const [name, value] of Object.entries(secrets)) {
    const encrypted = crypto_box_seal(
      new TextEncoder().encode(value),
      Uint8Array.from(Buffer.from(key, 'base64')),
    )
    const res = await api(`/repos/${REPO}/actions/secrets/${name}`, {
      method: 'PUT',
      body: JSON.stringify({ encrypted_value: b64(encrypted), key_id }),
    })
    console.log(name, '->', res.status === 201 || res.status === 204 ? 'OK' : `FAIL ${res.status} ${await res.text()}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
