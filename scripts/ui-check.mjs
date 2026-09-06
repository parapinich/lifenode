// Run: node scripts/ui-check.mjs [path-to-playwright] [preview-url]
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.argv[2] ? pathToFileURL(join(process.argv[2], 'index.mjs')).href : 'playwright')
const output = join(tmpdir(), 'lifenode-ui-check')

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = [], requests = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('dialog', (dialog) => dialog.accept())
  await mkdir(output, { recursive: true })
  try {
    await page.goto(process.argv[3] || 'http://localhost:3000', { waitUntil: 'networkidle' })
    await page.locator('.react-flow__node').first().waitFor()
    await page.getByRole('button', { name: 'ID', exact: true }).click()
    assert.equal(await page.locator('html').getAttribute('lang'), 'id')
    await page.screenshot({ path: join(output, 'sandbox-empty-id.png') })
    const composer = page.locator('.decision-palette .decision-composer')
    await composer.getByRole('textbox').fill('Buka toko buku di Bali')
    await composer.getByRole('button', { name: 'Tambah', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 3)
    const firstNode = page.locator('.react-flow__node-aksi').first()
    await firstNode.getByRole('spinbutton', { name: 'Durasi keputusan (tahun)' }).fill('0.5')
    await firstNode.getByRole('button', { name: 'Sementara itu', exact: true }).click()
    await firstNode.locator('.node-composer').getByRole('textbox').fill('Belajar selancar')
    await firstNode.locator('.node-composer').getByRole('button', { name: 'Tambah', exact: true }).click()
    assert.equal(await page.locator('.react-flow__node').count(), 4)
    assert(await page.getByRole('button', { name: 'Jalankan babak', exact: true }).isEnabled())
    await page.getByRole('button', { name: 'Urungkan', exact: true }).click()
    assert.equal(await page.locator('.react-flow__node').count(), 3)
    await page.getByRole('button', { name: 'Ulangi', exact: true }).click()
    assert.equal(await page.locator('.react-flow__node').count(), 4)

    const simpleGraph = await page.evaluate(() => localStorage.getItem('lifenode-graph'))
    let previous
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: 'Buka contoh kehidupan', exact: true }).first().click()
      const labels = await page.locator('.react-flow__node-aksi input[aria-label="Nama keputusan"]').evaluateAll((inputs) => inputs.map((input) => input.value).join('|'))
      assert.notEqual(labels, previous)
      previous = labels
    }
    await page.getByRole('button', { name: 'Rapikan posisi keputusan', exact: true }).click()
    await page.waitForTimeout(400)
    const boxes = await page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((n) => {
      const { x, y, width, height } = n.getBoundingClientRect(); return { x, y, width, height }
    }))
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]
      assert(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, 'Nodes overlap')
    }
    await page.screenshot({ path: join(output, 'sandbox-plan-id.png') })
    await page.getByRole('button', { name: 'EN', exact: true }).click()
    assert.equal(await page.locator('.react-flow__node-aksi input[aria-label="Decision name"]').evaluateAll((inputs) => inputs.map((input) => input.value).join('|')), previous)
    await page.getByRole('button', { name: 'ID', exact: true }).click()

    await page.evaluate((value) => localStorage.setItem('lifenode-graph', value), simpleGraph)
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('.react-flow__node-aksi').first().waitFor()
    await page.route('**/api/simulate', async (route) => {
      const request = route.request().postDataJSON()
      if (request.phase === 'assess') return route.fulfill({ json: { nodes: request.graph.nodes.filter((n) => n.kind === 'aksi' || n.kind === 'tunggu').map((n) => ({ nodeId: n.id, category: 'safe', annualProbability: 0, reason: 'Ordinary activity.' })), suddenCause: 'An unexpected accident.' } })
      requests.push(request)
      await new Promise((resolve) => setTimeout(resolve, 400))
      await route.fulfill({ json: {
        narasiSegmen: 'Toko bukumu punya pelanggan tetap. Mereka mulai menitipkan tanaman.',
        perNode: request.graph.nodes.filter((n) => n.kind === 'aksi').map((n) => ({ nodeId: n.id, status: 'sukses', teks: n.label, alasan: 'Ketekunanmu mulai membuahkan hasil.' })),
        narasiGap: [], kejadianPenting: ['Pelanggan menitipkan tanaman.'],
        stateBaru: { ...request.state, umur: 99, uang: request.state.uang + 100000, energi: 80 },
      } })
    })
    await page.getByRole('button', { name: 'Jalankan babak', exact: true }).click()
    await page.getByRole('button', { name: 'Berlangsung...', exact: true }).waitFor()
    await page.keyboard.press('Control+z')
    assert.equal(await page.locator('.react-flow__node').count(), 4)
    await page.getByRole('button', { name: 'Babak selesai', exact: true }).waitFor()
    assert.equal(requests[0].language, 'id')
    assert(await page.locator('.react-flow__node-aksi input[aria-label="Nama keputusan"]').first().isDisabled())
    await page.screenshot({ path: join(output, 'sandbox-results-id.png') })
    const response = page.locator('.chapter-response')
    await response.getByRole('textbox').fill('Buat kebun bersama pelanggan')
    await response.getByRole('button', { name: 'Babak baru', exact: true }).click()
    await page.getByRole('button', { name: 'Lanjutkan babak', exact: true }).click()
    await page.getByRole('button', { name: 'Babak selesai', exact: true }).waitFor()
    assert.equal(requests.length, 2)
    assert.deepEqual(requests[1].state.ledger, ['Pelanggan menitipkan tanaman.'])
    assert(requests[1].state.umur < 99)
    assert.equal(await page.locator('.segment-result').count(), 2)
    await page.route('**/api/summary', (route) => {
      assert.equal(route.request().postDataJSON().language, 'id')
      return route.fulfill({ json: { judulHidup: 'Penjaga buku dan tanaman', epitaf: 'Semua akhirnya tumbuh.', momenPenentu: ['Membuka toko.', 'Menerima tanaman.', 'Membuat kebun.'], skorPerLane: ['karir', 'relasi', 'kesehatan', 'chaos'].map((lane) => ({ lane, label: 'Tercatat' })) } })
    })
    await page.getByRole('button', { name: 'Rangkum hidup ini', exact: true }).click()
    await page.getByRole('dialog', { name: 'Ringkasan hidup' }).waitFor()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Simpan PNG' }).click()
    assert((await download).suggestedFilename().endsWith('.png'))
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Riwayat hidup' }).click()
    assert(await page.getByText('Penjaga buku dan tanaman').isVisible())
    await page.keyboard.press('Escape')

    for (const width of [390, 320, 768]) {
      await page.setViewportSize({ width, height: 844 })
      await page.waitForTimeout(200)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflows')
      const toolbar = await page.locator('.canvas-toolbar').boundingBox()
      const button = await page.getByRole('button', { name: 'Babak selesai', exact: true }).boundingBox()
      assert(button.x >= toolbar.x && button.x + button.width <= toolbar.x + toolbar.width + 1, 'Run button overflows')
      await page.screenshot({ path: join(output, `sandbox-mobile-${width}.png`) })
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Catatan hidup', exact: true }).click()
    await page.screenshot({ path: join(output, 'sandbox-mobile-results.png') })
    await page.getByRole('button', { name: 'EN', exact: true }).click()
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(await page.locator('html').getAttribute('lang'), 'en')
    await page.getByRole('button', { name: 'Chapter complete', exact: true }).waitFor()
    assert.equal(await page.locator('.segment-result').count(), 2, 'Chapter progress was lost on reload')
    assert.deepEqual(errors, [])
    console.log('Passed: free decisions, parallel connections, duration, rotating examples, EN/ID, chapter continuation, memory, past locks, export, history, responsive UI. Narration mocked.')
  } finally { await browser.close() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
