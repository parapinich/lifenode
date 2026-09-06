// Run: node scripts/mortality-check.mjs [path-to-playwright] [preview-url]
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.argv[2] ? pathToFileURL(join(process.argv[2], 'index.mjs')).href : 'playwright')
const output = join(tmpdir(), 'lifenode-ui-check')
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  await mkdir(output, { recursive: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    if (localStorage.getItem('mortality-fixture')) return
    localStorage.setItem('mortality-fixture', '1')
    localStorage.setItem('lifenode-run', JSON.stringify({ state: { mortalityClock: { seed: 0.5, exposure: 0 } }, version: 0 }))
    const nodes = [
      { id: 'start', kind: 'start', x: 0, y: 200 },
      { id: 'work', kind: 'aksi', label: 'Work', lane: 'karir', durasi: 1, x: 260, y: 0 },
      { id: 'fatal', kind: 'aksi', label: 'Unprotected jump from a 50-storey building', lane: 'chaos', durasi: 1, x: 540, y: 0 },
      { id: 'parallel', kind: 'aksi', label: 'Study', lane: 'karir', durasi: 4, x: 260, y: 350 },
      { id: 'later', kind: 'aksi', label: 'Travel', lane: 'chaos', durasi: 30, x: 820, y: 0 },
      { id: 'end', kind: 'end', x: 1100, y: 200 },
    ]
    const edges = [['start', 'work'], ['work', 'fatal'], ['fatal', 'later'], ['later', 'end'], ['start', 'parallel'], ['parallel', 'end']].map(([from, to], i) => ({ id: String(i), from, to }))
    localStorage.setItem('lifenode-graph', JSON.stringify({ state: { nodes, edges, kondisiAwal: { umur: 20, uang: 1000, latarBelakang: 'Ordinary life' } }, version: 0 }))
  })
  let assessments = 0, narrations = 0
  await page.route('**/api/simulate', async (route) => {
    const body = route.request().postDataJSON()
    if (body.phase === 'assess') {
      assessments++
      return route.fulfill({ json: { nodes: body.graph.nodes.filter((n) => n.kind === 'aksi').map((n) => ({ nodeId: n.id, category: n.id === 'fatal' ? 'fatal' : 'safe', annualProbability: 0, reason: n.id === 'fatal' ? 'A fatal fall without protection.' : 'Ordinary activity.' })), suddenCause: 'An unexpected accident.' } })
    }
    narrations++
    if (narrations === 1) return route.fulfill({ status: 502, json: { error: 'offline' } })
    return route.fulfill({ json: { narasiSegmen: 'After a year of work, a fatal fall ends this life. Studies remain unfinished.', perNode: ['work', 'fatal', 'parallel'].map((nodeId) => ({ nodeId, status: 'sukses', teks: nodeId === 'parallel' ? 'Studies were interrupted.' : nodeId === 'fatal' ? 'A fatal fall.' : 'One year of work completed.' })), narasiGap: [], kejadianPenting: ['One year of work completed.'], stateBaru: { ...body.state, umur: 99, hidup: true } } })
  })
  await page.goto(process.argv[3] || 'http://localhost:3000', { waitUntil: 'networkidle' })
  const duration = page.locator('[data-id="later"] input[type="number"]')
  await duration.waitFor()
  assert.equal(await duration.inputValue(), '30')
  assert.equal(await duration.getAttribute('max'), null)
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  await page.waitForFunction(() => document.documentElement.lang === 'id')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.waitForFunction(() => document.documentElement.lang === 'en')
  await page.getByRole('button', { name: 'Run chapter', exact: true }).click()
  await page.getByRole('button', { name: 'Continue with risk', exact: true }).waitFor().catch(async (error) => {
    console.log(errors, assessments, narrations, await page.locator('.canvas-toolbar').innerText(), await page.locator('.case-alert').allTextContents(), await page.evaluate(() => localStorage.getItem('lifenode-run')))
    await page.screenshot({ path: join(output, 'mortality-failure.png') })
    throw error
  })
  assert.equal(narrations, 0)
  await page.getByText('Fatal action', { exact: true }).waitFor()
  await page.screenshot({ path: join(output, 'mortality-risk-desktop.png') })
  await page.getByRole('button', { name: 'Continue with risk', exact: true }).click()
  await page.getByRole('button', { name: 'Try again', exact: true }).waitFor()
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('lifenode-run')).state.pendingRisk)
  await page.reload({ waitUntil: 'networkidle' })
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('lifenode-run')).state.pendingRisk), pending)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByRole('button', { name: 'Life ended', exact: true }).waitFor()
  assert.equal(assessments, 1)
  assert.equal(narrations, 2)
  const run = await page.evaluate(() => JSON.parse(localStorage.getItem('lifenode-run')).state)
  assert.equal(run.lifeState.hidup, false)
  assert.equal(run.lifeState.umur, 21)
  assert.equal(run.nodeStatus.parallel, 'terhenti')
  assert.equal(run.nodeStatus.later, 'skipped')
  assert(await page.getByRole('button', { name: 'Life ended', exact: true }).isDisabled())
  await page.screenshot({ path: join(output, 'mortality-ended-desktop.png') })
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  const caseToggle = page.getByRole('button', { name: 'Catatan hidup', exact: true })
  if (await caseToggle.getAttribute('aria-expanded') !== 'true') await caseToggle.click()
  await page.locator('.segment-result').scrollIntoViewIfNeeded()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: join(output, 'mortality-ended-mobile-id.png') })
  assert.deepEqual(errors, [])
  console.log('Passed: 30-year input, risk preview, fatal outcome, interrupted parallel node, skipped future, retry/reload, EN/ID and desktop/mobile. Narration mocked.')
} finally { await browser.close() }
