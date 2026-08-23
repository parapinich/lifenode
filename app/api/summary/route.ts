import { NextResponse } from 'next/server'
import { RingkasanRequestSchema, RingkasanResponseSchema } from '@/lib/schema'
import { SUMMARY_SYSTEM_PROMPT, buildSummaryUserMessage } from '@/lib/prompts'
import { callStructuredLLM, LLMError } from '@/lib/llm'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = RingkasanRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', detail: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const summary = await callStructuredLLM(SUMMARY_SYSTEM_PROMPT, buildSummaryUserMessage(parsed.data), RingkasanResponseSchema)
    return NextResponse.json(summary)
  } catch (e) {
    if (e instanceof LLMError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Summary failed to process' }, { status: 502 })
  }
}
