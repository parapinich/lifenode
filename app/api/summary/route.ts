import { NextResponse } from 'next/server'
import { RingkasanRequestSchema, RingkasanResponseSchema } from '@/lib/schema'
import { SUMMARY_SYSTEM_PROMPT, buildSummaryUserMessage, narrativePrompt } from '@/lib/prompts'
import { callStructuredLLM, llmErrorBody } from '@/lib/llm'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = RingkasanRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', detail: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const summary = await callStructuredLLM(narrativePrompt(SUMMARY_SYSTEM_PROMPT, parsed.data.language), buildSummaryUserMessage(parsed.data), RingkasanResponseSchema)
    return NextResponse.json(summary)
  } catch (e) {
    const { body, status } = llmErrorBody(e, 'Summary failed to process')
    return NextResponse.json(body, { status })
  }
}
