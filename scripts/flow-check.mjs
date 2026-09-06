// Run: node scripts/flow-check.mjs [path-to-playwright] [preview-url]
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
  await page.goto(process.argv[3] || 'http://localhost:3000', { waitUntil: 'networkidle' })
  await page.locator('.react-flow__node').first().waitFor()
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  const form = page.locator('.decision-palette .decision-composer')
  await form.getByRole('textbox').fill('Open a bookshop')
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Tidy up node positions', exact: true }).click()
  await page.waitForTimeout(400)
  const edge = page.locator('.react-flow__edge').last().locator('.react-flow__edge-interaction')
  const edgePoint = await edge.evaluate((path) => { const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()); return { x: point.x, y: point.y } })
  await page.mouse.click(edgePoint.x, edgePoint.y)
  await page.getByRole('button', { name: 'Insert node', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Insert node', exact: true })
  await dialog.getByRole('combobox').selectOption('event')
  await page.screenshot({ path: join(output, 'flow-insert-dark.png') })
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.react-flow__node-event').count(), 0)
  await page.mouse.click(edgePoint.x, edgePoint.y)
  await page.getByRole('button', { name: 'Insert node', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Insert node', exact: true })
  await dialog.getByRole('combobox').selectOption('event')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await page.locator('.react-flow__node-event').waitFor()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  assert.equal(await page.locator('.react-flow__node-event').count(), 0)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  assert.equal(await page.locator('.react-flow__node-event').count(), 1)
  await page.screenshot({ path: join(output, 'flow-plan-dark.png') })
  const incident = { title: 'A forgotten invitation', story: 'A former customer offers you a place at a local fair.', options: [
    { label: 'Join the fair', consequence: 'You reserve a stall.', uang: -50, energi: -5, reputasi: 5, kebahagiaan: 10, skill: [], relasi: [] },
    { label: 'Stay with the shop', consequence: 'Your customers find you at the shop.', uang: 10, energi: 0, reputasi: 1, kebahagiaan: 1, skill: [], relasi: [] },
  ] }
  let eventCalls = 0, simulationCalls = 0
  await page.evaluate(() => { Math.random = () => 0.1 })
  await page.route('**/api/event', async (route) => {
    eventCalls++
    await route.fulfill(eventCalls === 1 ? { status: 502, json: { error: 'offline' } } : { json: incident })
  })
  await page.route('**/api/simulate', async (route) => {
    simulationCalls++
    const body = route.request().postDataJSON()
    const actions = body.fromSyncId === 'start' ? body.graph.nodes.filter((n) => n.kind === 'aksi') : []
    await route.fulfill({ json: { narasiSegmen: 'The shop opens.', perNode: actions.map((n) => ({ nodeId: n.id, status: 'sukses', teks: 'Customers arrive.' })), narasiGap: [], kejadianPenting: [], stateBaru: { ...body.state, umur: body.state.umur + (actions.length ? 1 : 0) } } })
  })
  await page.getByRole('button', { name: 'Run chapter', exact: true }).click()
  await page.locator('.event-response [role="alert"]').waitFor()
  await page.locator('.event-response').getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByText(incident.title, { exact: true }).waitFor()
  assert.equal(simulationCalls, 1)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText(incident.title, { exact: true }).waitFor()
  assert.equal(eventCalls, 2)
  await page.screenshot({ path: join(output, 'flow-event-dark.png') })
  await page.getByRole('button', { name: 'Join the fair', exact: true }).click()
  await page.getByRole('button', { name: 'Chapter complete', exact: true }).waitFor()
  assert.match(await page.locator('.resource-ledger').innerText(), /-\$50/)
  assert.equal(await page.locator('.segment-result').count(), 3)
  await page.getByRole('button', { name: 'Light mode', exact: true }).click()
  await page.getByRole('button', { name: 'ID', exact: true }).click()
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await page.waitForTimeout(200)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    for (const control of await page.locator('.masthead button').all()) {
      const box = await control.boundingBox()
      assert(box && box.x >= 0 && box.x + box.width <= width, 'Header control is clipped')
    }
    await page.screenshot({ path: join(output, `flow-light-mobile-${width}.png`) })
  }
  assert.deepEqual(errors, [])
  console.log('Passed: theme persistence, edge insertion/cancel/undo, event failure/retry/reload/response, EN/ID, mobile. Narration mocked.')
} finally { await browser.close() }
