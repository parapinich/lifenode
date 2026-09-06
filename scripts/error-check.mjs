// Drives the real UI into a Groq rate limit and checks what the player is told.
// Run: node scripts/error-check.mjs [path-to-playwright] [preview-url]
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.argv[2] ? pathToFileURL(join(process.argv[2], 'index.mjs')).href : 'playwright')

const url = process.argv[3] || 'http://localhost:3000'
const output = join(tmpdir(), 'lifenode-ui-check')
const graph = {
  nodes: [
    { id: 'start', kind: 'start', x: 0, y: 0 },
    { id: 'a1', kind: 'aksi', lane: 'karir', label: 'Open a coffee shop', intensity: 3, x: 300, y: 0 },
    { id: 'w1', kind: 'tunggu', durasi: 5, x: 600, y: 0 },
    { id: 'end', kind: 'end', x: 900, y: 0 },
  ],
  edges: [{ id: 'e1', from: 'start', to: 'a1' }, { id: 'e2', from: 'a1', to: 'w1' }, { id: 'e3', from: 'w1', to: 'end' }],
  kondisiAwal: { umur: 20, uang: 100000, latarBelakang: '' },
}

await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate((g) => {
    localStorage.clear()
    localStorage.setItem('lifenode-graph', JSON.stringify({ state: g, version: 0 }))
  }, graph)

  const execute = page.getByRole('button', { name: /Run chapter|Continue chapter|Try again/ })
  const alert = page.locator('.case-alert')

  // --- 1. A non-retryable fault names its stage and keeps the server's words.
  await page.route('**/api/simulate', (r) => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: "Unknown sync point 'nope'" }) }))
  await page.reload({ waitUntil: 'networkidle' })
  await execute.click()
  await alert.waitFor()
  const fault = await alert.innerText()
  console.log('fault alert     :', JSON.stringify(fault))
  assert.match(fault, /Risk assessment: Unknown sync point 'nope'/)
  assert.equal(await execute.isDisabled(), false, 'a non-retryable fault must not lock the button')

  // --- 2. A rate limit shows the wait and locks the button until it elapses.
  await page.unroute('**/api/simulate')
  await page.route('**/api/simulate', (r) => r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Rate limited by Groq API', retryAfter: 3 }) }))
  await page.reload({ waitUntil: 'networkidle' })
  await execute.click()
  await page.waitForFunction(() => /Try again in/.test(document.querySelector('.execute-button')?.innerText ?? ''))
  console.log('limited alert   :', JSON.stringify(await alert.innerText()))
  console.log('limited button  :', JSON.stringify(await execute.innerText()))
  assert.match(await alert.innerText(), /Risk assessment: Rate limited by Groq API/)
  assert.match(await execute.innerText(), /Try again in [1-4]s/)
  await page.screenshot({ path: join(output, 'rate-limited.png') })
  assert.equal(await execute.isDisabled(), true, 'the button must be locked while the limit stands')

  // The countdown has to actually release, not park the player forever.
  await page.waitForFunction(() => document.querySelector('.execute-button')?.disabled === false, null, { timeout: 8000 })
  console.log('released button :', JSON.stringify(await execute.innerText()))
  assert.doesNotMatch(await execute.innerText(), /Try again in/)

  // A stale countdown must not survive a reload.
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await execute.isDisabled(), false, 'an expired countdown must not come back on reload')

  // --- 3. Indonesian translates the stage, keeps the upstream detail.
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  await page.getByRole('button', { name: /Coba lagi|Jalankan|Lanjutkan/ }).click()
  await page.waitForFunction(() => /Penilaian risiko/.test(document.querySelector('.case-alert')?.innerText ?? ''))
  const indonesian = await alert.innerText()
  console.log('ID alert        :', JSON.stringify(indonesian))
  console.log('ID button       :', JSON.stringify(await page.locator('.execute-button').innerText()))
  assert.match(indonesian, /Penilaian risiko: Rate limited by Groq API/)
  assert.match(await page.locator('.execute-button').innerText(), /Coba lagi dalam [1-4]s/)

  // --- 4. Nothing leaks the key, and no React error along the way.
  const body = await page.locator('body').innerText()
  assert.doesNotMatch(body, /gsk_|GROQ_API_KEY=|Bearer /, 'no credential may reach the page')
  assert.deepEqual(pageErrors, [])
  console.log('\nOK - all error-surface checks passed')
} finally {
  await browser.close()
}
