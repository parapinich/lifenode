#!/usr/bin/env node
// PostToolUse hook (Edit|Write): after lib/schema.ts or lib/graph.ts changes,
// run typecheck + test right away so a broken invariant shows up immediately
// instead of at the end of a session. Non-blocking: always exits 0.
const { execSync } = require('child_process')

let data = ''
process.stdin.on('data', (c) => (data += c))
process.stdin.on('end', () => {
  let input
  try {
    input = JSON.parse(data)
  } catch {
    return
  }
  const filePath = (input.tool_input && input.tool_input.file_path) || ''
  if (!/[\\/]lib[\\/](schema|graph)\.ts$/.test(filePath)) return

  console.log(`[check-graph] ${filePath} changed, running typecheck + test...`)
  try {
    execSync('npm run typecheck', { stdio: 'inherit' })
  } catch {
    console.log('[check-graph] typecheck failed, see output above')
  }
  try {
    execSync('npm run test', { stdio: 'inherit' })
  } catch {
    console.log('[check-graph] tests failed, see output above')
  }
})
