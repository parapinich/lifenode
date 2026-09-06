// Plays a whole chapter through the REAL Groq API, waiting out rate limits the
// way a player has to, then reads the summary card.
// Run: node scripts/e2e-check.mjs [path-to-playwright] [preview-url]
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.argv[2] ? pathToFileURL(join(process.argv[2], 'index.mjs')).href : 'playwright')

const url = process.argv[3] || 'http://localhost:3000'
const output = join(tmpdir(), 'lifenode-ui-check')

// One If, one Random Event, one parallel pair — every LLM stage in one chapter.
const graph = {
  nodes: [
    { id: 'start', kind: 'start', x: 0, y: 0 },
    { id: 'a1', kind: 'aksi', lane: 'karir', label: 'Open a coffee shop', intensity: 3, durasi: 1, x: 260, y: 0 },
    { id: 'a2', kind: 'aksi', lane: 'relasi', label: 'Move in with someone', intensity: 2, durasi: 1, x: 260, y: 190 },
    { id: 'w1', kind: 'tunggu', durasi: 4, x: 520, y: 0 },
    { id: 'w2', kind: 'tunggu', durasi: 4, x: 520, y: 190 },
    { id: 'm1', kind: 'merge', x: 760, y: 95 },
    { id: 'choice', kind: 'if', x: 1000, y: 95 },
    { id: 'a3', kind: 'aksi', lane: 'karir', label: 'Open a second branch', intensity: 3, durasi: 1, x: 1240, y: 0 },
    { id: 'a4', kind: 'aksi', lane: 'chaos', label: 'Sell everything and leave', intensity: 3, durasi: 1, x: 1240, y: 190 },
    { id: 'ev', kind: 'event', x: 1500, y: 95 },
    { id: 'end', kind: 'end', x: 1740, y: 95 },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'a1' }, { id: 'e2', from: 'a1', to: 'w1' }, { id: 'e3', from: 'w1', to: 'm1' },
    { id: 'e4', from: 'start', to: 'a2' }, { id: 'e5', from: 'a2', to: 'w2' }, { id: 'e6', from: 'w2', to: 'm1' },
    { id: 'e7', from: 'm1', to: 'choice' },
    { id: 'e8', from: 'choice', to: 'a3', label: 'the shop turned a profit' },
    { id: 'e9', from: 'choice', to: 'a4', label: 'the shop went under' },
    { id: 'e10', from: 'a3', to: 'ev' }, { id: 'e11', from: 'a4', to: 'ev' },
    { id: 'e12', from: 'ev', to: 'end' },
  ],
  kondisiAwal: { umur: 22, uang: 50000, latarBelakang: 'Inherited a small savings account' },
}

await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const findings = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const pageErrors = []
  const upstream = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('response', (r) => { if (r.url().includes('/api/')) upstream.push(`${r.status()} ${new URL(r.url()).pathname}`) })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate((g) => {
    localStorage.clear()
    localStorage.setItem('lifenode-graph', JSON.stringify({ state: g, version: 0 }))
  }, graph)
  await page.reload({ waitUntil: 'networkidle' })

  const button = page.locator('.execute-button')
  const alert = page.locator('.case-alert')
  const label = () => button.innerText()

  // Click through the whole chapter. Wait out every cooldown; a run should never
  // need more than one retry per segment to make progress.
  for (let step = 0; step < 24; step++) {
    const state = await page.evaluate(() => {
      const run = JSON.parse(localStorage.getItem('lifenode-run') ?? '{}').state ?? {}
      return { done: !!run.chapterComplete, alive: run.lifeState?.hidup, cursor: run.nextSyncId, results: run.results?.length ?? 0, error: run.error }
    })
    if (state.done) { console.log(`chapter complete after ${step} clicks, ${state.results} segments, alive=${state.alive}`); break }

    if (!(await button.count())) {
      await page.screenshot({ path: join(output, 'e2e-stuck.png') })
      findings.push(`the Execute button vanished at cursor=${state.cursor} results=${state.results} error=${state.error}`)
      break
    }
    const text = await label()
    if (/Try again in/.test(text)) {
      const seconds = Number(text.match(/(\d+)s/)?.[1] ?? 1)
      console.log(`  cooldown ${seconds}s (${await alert.innerText().catch(() => '')})`)
      await page.waitForFunction(() => document.querySelector('.execute-button')?.disabled === false, null, { timeout: (seconds + 20) * 1000 })
      continue
    }
    const options = page.locator('.event-response [role="group"] button')
    if (await options.count()) {
      console.log(`  random event: "${await page.locator('.event-response h3').innerText()}" -> "${await options.first().innerText()}"`)
      await options.first().click()
      await page.waitForFunction(() => !document.querySelector('.execute-button .animate-spin'), null, { timeout: 90_000 })
      continue
    }
    const eventRetry = page.locator('.event-response button', { hasText: /Try again in/ })
    if (await eventRetry.count()) {
      console.log(`  event cooldown: "${await eventRetry.innerText()}" (${await page.locator('.event-response [role="alert"]').innerText()})`)
      await page.waitForFunction(() => {
        const b = [...document.querySelectorAll('.event-response button')].find((b) => /Try again/.test(b.innerText))
        return b && !b.disabled
      }, null, { timeout: 60_000 })
      await page.locator('.event-response button', { hasText: /Try again/ }).click()
      await page.waitForFunction(() => !document.querySelector('.execute-button .animate-spin'), null, { timeout: 90_000 })
      continue
    }
    console.log(`click ${step}: "${text}" (cursor=${state.cursor}, results=${state.results})`)
    await button.click()
    await page.waitForFunction(() => !document.querySelector('.execute-button .animate-spin'), null, { timeout: 90_000 })
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('lifenode-run') ?? '{}').state?.error ?? null)
    if (after) console.log(`  -> ${after}`)
  }

  const run = await page.evaluate(() => JSON.parse(localStorage.getItem('lifenode-run') ?? '{}').state ?? {})
  console.log('\nsegments:', run.results?.length, '| alive:', run.lifeState?.hidup, '| age:', run.lifeState?.umur, '| ledger:', run.lifeState?.ledger?.length)
  console.log('branch chosen:', JSON.stringify(run.selectedBranches))
  console.log('upstream calls:', upstream.join(', '))
  if (!run.chapterComplete) findings.push(`chapter never completed; last error: ${run.error}`)

  // The summary card is the payoff — it must render, and it must survive a
  // rate-limited attempt without stranding the player.
  await page.screenshot({ path: join(output, 'e2e-chapter.png'), fullPage: false })
  // Closing the case is what asks for the summary — the last unexercised stage.
  const closeCase = page.locator('.close-case-button')
  const verdict = page.locator('dialog.case-dialog')
  for (let attempt = 0; attempt < 6; attempt++) {
    if (await verdict.count()) break
    if (!(await closeCase.count())) break
    if (await closeCase.isDisabled()) {
      const text = await closeCase.innerText()
      if (/Try again in/.test(text)) console.log(`  summary cooldown: "${text}"`)
      await page.waitForFunction(() => {
        const b = document.querySelector('.close-case-button')
        return !b || !b.disabled || document.querySelector('dialog.case-dialog')
      }, null, { timeout: 90_000 })
      continue
    }
    await closeCase.click()
    await page.waitForFunction(() => {
      const run = JSON.parse(localStorage.getItem('lifenode-run') ?? '{}').state ?? {}
      return !run.summaryLoading
    }, null, { timeout: 90_000 })
    const err = await page.evaluate(() => JSON.parse(localStorage.getItem('lifenode-run') ?? '{}').state?.summaryError ?? null)
    if (err) console.log(`  -> ${err}`)
  }
  if (await verdict.count()) {
    const summary = await page.evaluate(() => JSON.parse(localStorage.getItem('lifenode-run') ?? '{}').state ?? {})
    console.log('summary:', summary.summary?.judulHidup ?? `FAILED -> ${summary.summaryError}`)
    if (summary.summaryError) findings.push(`summary failed: ${summary.summaryError}`)
    await page.screenshot({ path: join(output, 'e2e-summary.png') })
    const card = await verdict.innerText()
    console.log('\n--- life card ---\n' + card)
    if (!/\S/.test(card)) findings.push('the verdict dialog rendered empty')
  } else findings.push('no verdict dialog after the chapter closed')

  if (pageErrors.length) findings.push(`page errors: ${pageErrors.join(' | ')}`)
  const body = await page.locator('body').innerText()
  if (/gsk_|GROQ_API_KEY|Bearer /.test(body)) findings.push('a credential reached the page')

  console.log(`\nscreenshots: ${output}`)
  if (findings.length) {
    console.log('\nFINDINGS:')
    for (const f of findings) console.log(' -', f)
    process.exitCode = 1
  } else console.log('\nOK - end-to-end chapter played through with no findings')
} finally {
  await browser.close()
}
assert.ok(true)
