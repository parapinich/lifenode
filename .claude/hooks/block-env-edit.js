#!/usr/bin/env node
// PreToolUse hook (Edit|Write): block edits to any .env* file. API keys
// (GROQ_API_KEY etc.) live there, and CLAUDE.md's own rules say keys must
// never be touched outside the server route handlers.
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
  if (!/(^|[\\/])\.env($|\.[^\\/]*)$/.test(filePath)) return

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'This file holds API keys. CLAUDE.md requires they stay server-only and never be touched by tool calls, edit it yourself outside Claude Code if needed.',
      },
    })
  )
})
