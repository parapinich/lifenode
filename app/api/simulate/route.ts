import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  GraphSchema,
  KondisiAwalSchema,
  LifeStateSchema,
  SegmentRequestSchema,
  SegmentResponseSchema,
} from '@/lib/schema'
import { computeGraph, segmentCabang, validateGraph, GraphCycleError } from '@/lib/graph'
import { hitungKepadatan } from '@/lib/engine'
import { SYSTEM_PROMPT, buildSegmentUserMessage } from '@/lib/prompts'
import { callStructuredLLM, LLMError } from '@/lib/llm'

const MAX_SEGMEN = 6

const RequestSchema = z.object({
  graph: GraphSchema,
  kondisiAwal: KondisiAwalSchema,
  segmentIndex: z.number().int().min(0),
  state: LifeStateSchema,
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', detail: parsed.error.flatten() }, { status: 400 })
  }
  const { graph, kondisiAwal, segmentIndex, state } = parsed.data

  // The server doesn't trust the client's math — recompute from the raw graph.
  const issues = validateGraph(graph)
  if (issues.length > 0) {
    return NextResponse.json({ error: 'Invalid graph', issues }, { status: 400 })
  }

  let computation
  try {
    computation = computeGraph(graph, kondisiAwal.umur)
  } catch (e) {
    if (e instanceof GraphCycleError) return NextResponse.json({ error: e.message }, { status: 400 })
    throw e
  }

  const { segments, timing } = computation
  if (segments.length > MAX_SEGMEN) {
    return NextResponse.json({ error: `Maximum ${MAX_SEGMEN} segments per run` }, { status: 400 })
  }
  if (segmentIndex >= segments.length) {
    return NextResponse.json({ error: 'segmentIndex out of range' }, { status: 400 })
  }

  const segment = segments[segmentIndex]
  const cabang = segmentCabang(segment, graph.nodes, timing)
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
