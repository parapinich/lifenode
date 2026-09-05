import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  GraphSchema,
  KondisiAwalSchema,
  LifeStateSchema,
  SegmentRequestSchema,
  SegmentResponseSchema,
} from '@/lib/schema'
import { computeGraph, computeOneSegment, executionGraph, segmentCabang, validateGraph, GraphCycleError } from '@/lib/graph'
import { hitungKepadatan } from '@/lib/engine'
import { SYSTEM_PROMPT, buildSegmentUserMessage, narrativePrompt } from '@/lib/prompts'
import { callStructuredLLM, LLMError } from '@/lib/llm'

const RequestSchema = z.object({
  language: z.enum(['en', 'id']).default('en'),
  choices: z.record(z.string(), z.string()).default({}),
  graph: GraphSchema,
  kondisiAwal: KondisiAwalSchema,
  fromSyncId: z.string(),
  state: LifeStateSchema,
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', detail: parsed.error.flatten() }, { status: 400 })
  }
  const { graph, kondisiAwal, fromSyncId, state, language, choices } = parsed.data

  // The server doesn't trust the client's math — recompute from the raw graph.
  // validateGraph also enforces the worst-case 6-LLM-call budget (CLAUDE.md §5).
  const issues = validateGraph(graph)
  if (issues.length > 0) {
    return NextResponse.json({ error: 'Invalid graph', issues }, { status: 400 })
  }

  let timing
  let playable
  try {
    playable = executionGraph(graph, choices)
    timing = computeGraph(playable, kondisiAwal.umur).timing
  } catch (e) {
    if (e instanceof GraphCycleError) return NextResponse.json({ error: e.message }, { status: 400 })
    return NextResponse.json({ error: 'Invalid branch choices' }, { status: 400 })
  }

  if (!timing[fromSyncId]) {
    return NextResponse.json({ error: `Unknown sync point '${fromSyncId}'` }, { status: 400 })
  }

  let segment
  try {
    segment = computeOneSegment(playable.nodes, playable.edges, timing, fromSyncId)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to compute segment' }, { status: 400 })
  }

  const cabang = segmentCabang(segment, playable.nodes, playable.edges, timing)
  const lamaSegmen = segment.umurSelesai - segment.umurMulai
  const kepadatan = hitungKepadatan(cabang, lamaSegmen)

  const parsedRequest = SegmentRequestSchema.safeParse({
    segmen: { id: segment.id, umurMulai: segment.umurMulai, umurSelesai: segment.umurSelesai },
    state,
    cabang,
    kepadatan,
  })
  if (!parsedRequest.success) {
    return NextResponse.json({ error: 'Failed to build segment request', detail: parsedRequest.error.flatten() }, { status: 400 })
  }
  const llmRequest = parsedRequest.data

  try {
    const llmResponse = await callStructuredLLM(narrativePrompt(SYSTEM_PROMPT, language), buildSegmentUserMessage(llmRequest), SegmentResponseSchema)
    if (llmResponse.perNode.length !== segment.nodeIds.length || new Set(llmResponse.perNode.map((n) => n.nodeId)).size !== segment.nodeIds.length || llmResponse.perNode.some((n) => !segment.nodeIds.includes(n.nodeId))) {
      return NextResponse.json({ error: 'Invalid decision outcomes' }, { status: 502 })
    }
    llmResponse.stateBaru.umur = segment.umurSelesai
    return NextResponse.json(llmResponse)
  } catch (e) {
    if (e instanceof LLMError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Segment failed to process' }, { status: 502 })
  }
}
