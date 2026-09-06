import { NextResponse } from 'next/server'
import { z } from 'zod'
import { GraphSchema, KondisiAwalSchema, LifeStateSchema, RandomEventSchema } from '@/lib/schema'
import { computeGraph, executionGraph, validateGraph } from '@/lib/graph'
import { callStructuredLLM, LLMError } from '@/lib/llm'
import { narrativePrompt } from '@/lib/prompts'

const RequestSchema = z.object({ graph: GraphSchema, kondisiAwal: KondisiAwalSchema, state: LifeStateSchema, choices: z.record(z.string(), z.string()).default({}), eventNodeId: z.string(), seed: z.number().min(0).max(1), language: z.enum(['en', 'id']).default('en') })

export async function POST(req: Request) {
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { graph, kondisiAwal, choices, state, eventNodeId, language, seed } = parsed.data
  if (validateGraph(graph).length) return NextResponse.json({ error: 'Invalid graph' }, { status: 400 })
  let past
  try {
    const playable = executionGraph(graph, choices)
    const { timing } = computeGraph(playable, kondisiAwal.umur)
    if (!playable.nodes.some((n) => n.id === eventNodeId && n.kind === 'event') || timing[eventNodeId].umurMulai !== state.umur || !state.hidup) throw new Error('Invalid event')
    past = playable.nodes.filter((n) => n.kind === 'aksi' && timing[n.id].umurSelesai <= state.umur)
  } catch { return NextResponse.json({ error: 'Invalid event context' }, { status: 400 }) }
  try {
    const event = await callStructuredLLM(narrativePrompt(`Create a surprising, plausible incident in this life simulation. Use the actual past, relationships, resources and age; vary positive, difficult and unusual events. Never repeat a ledger event. The player did not author this incident. Supply two or three distinct responses with believable tradeoffs. Each option describes its immediate consequence and numeric DELTAS, not totals, for money, energy, reputation and happiness; skill contains only gained skills, relasi only new or updated relationships. Keep stakes proportional to the person's funds and context. This incident and responses are immediate: do not advance age, kill the character, or invent years of progress. No option is chosen yet. Story text must not reveal the hidden consequences. Return JSON.`, language), JSON.stringify({ kondisiAwal, state, past, seed }), RandomEventSchema)
    return NextResponse.json(event)
  } catch (e) {
    return NextResponse.json({ error: e instanceof LLMError ? e.message : 'Event generation failed' }, { status: e instanceof LLMError ? e.status : 502 })
  }
}
