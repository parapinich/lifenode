import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  GraphSchema,
  KondisiAwalSchema,
  LifeStateSchema,
  SegmentRequestSchema,
  SegmentResponseSchema,
} from '@/lib/schema'
import { computeGraph, computeOneSegment, segmentCabang, validateGraph, GraphCycleError } from '@/lib/graph'
import { hitungKepadatan } from '@/lib/engine'
import { SYSTEM_PROMPT, buildSegmentUserMessage } from '@/lib/prompts'
import { callStructuredLLM, LLMError } from '@/lib/llm'

const RequestSchema = z.object({
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
  const { graph, kondisiAwal, fromSyncId, state } = parsed.data

  // The server doesn't trust the client's math — recompute from the raw graph.
  // validateGraph also enforces the worst-case 6-LLM-call budget (CLAUDE.md §5).
  const issues = validateGraph(graph)
  if (issues.length > 0) {
    return NextResponse.json({ error: 'Invalid graph', issues }, { status: 400 })
  }

  let timing
  try {
    timing = computeGraph(graph, kondisiAwal.umur).timing
  } catch (e) {
    if (e instanceof GraphCycleError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }

  if (!timing[fromSyncId]) {
    return NextResponse.json({ error: `Unknown sync point '${fromSyncId}'` }, { status: 400 })
  }

  let segment
  try {
    segment = computeOneSegment(graph.nodes, graph.edges, timing, fromSyncId)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to compute segment' }, { status: 400 })
  }

  const cabang = segmentCabang(segment, graph.nodes, graph.edges, timing)
  const lamaSegmen = segment.umurSelesai - segment.umurMulai
  const kepadatan = hitungKepadatan(cabang, lamaSegmen)

  const llmRequest = SegmentRequestSchema.parse({
    segmen: { id: segment.id, umurMulai: segment.umurMulai, umurSelesai: segment.umurSelesai },
    state,
    cabang,
    kepadatan,
  })

  try {
    const llmResponse = await callStructuredLLM(SYSTEM_PROMPT, buildSegmentUserMessage(llmRequest), SegmentResponseSchema)
    return NextResponse.json(llmResponse)
  } catch (e) {
    if (e instanceof LLMError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Segment failed to process' }, { status: 502 })
  }
}
