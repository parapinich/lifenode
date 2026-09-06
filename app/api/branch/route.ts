import { NextResponse } from 'next/server'
import { z } from 'zod'
import { GraphSchema, IfRequestSchema, IfResponseSchema, KondisiAwalSchema, LifeStateSchema } from '@/lib/schema'
import { computeGraph, executionGraph, validateGraph, GraphCycleError } from '@/lib/graph'
import { IF_SYSTEM_PROMPT, buildIfUserMessage, narrativePrompt } from '@/lib/prompts'
import { callStructuredLLM, llmErrorBody } from '@/lib/llm'

const RequestSchema = z.object({
  language: z.enum(['en', 'id']).default('en'),
  choices: z.record(z.string(), z.string()).default({}),
  graph: GraphSchema,
  kondisiAwal: KondisiAwalSchema,
  state: LifeStateSchema,
  ifNodeId: z.string(),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', detail: parsed.error.flatten() }, { status: 400 })
  }
  const { graph, kondisiAwal, state, ifNodeId, language, choices } = parsed.data

  // The server doesn't trust the client's math — recompute from the raw graph.
  const issues = validateGraph(graph)
  if (issues.length > 0) {
    return NextResponse.json({ error: 'Invalid graph', issues }, { status: 400 })
  }

  const ifNode = graph.nodes.find((n) => n.id === ifNodeId)
  if (!ifNode || ifNode.kind !== 'if') {
    return NextResponse.json({ error: `'${ifNodeId}' is not an If node` }, { status: 400 })
  }
  const pilihan = graph.edges
    .filter((e) => e.from === ifNodeId)
    .filter((e, index, all) => all.findIndex((other) => other.label === e.label) === index)
    .map((e) => ({ edgeId: e.id, label: e.label ?? '' }))

  let timing
  try {
    timing = computeGraph(executionGraph(graph, choices), kondisiAwal.umur).timing
  } catch (e) {
    if (e instanceof GraphCycleError) return NextResponse.json({ error: e.message }, { status: 400 })
    return NextResponse.json({ error: 'Invalid branch choices' }, { status: 400 })
  }
  if (!timing[ifNodeId]) {
    return NextResponse.json({ error: `Unknown if node '${ifNodeId}'` }, { status: 400 })
  }

  const parsedRequest = IfRequestSchema.safeParse({
    ifNodeId,
    umurSaatIni: timing[ifNodeId].umurMulai,
    state,
    pilihan,
  })
  if (!parsedRequest.success) {
    return NextResponse.json({ error: 'Failed to build branch request', detail: parsedRequest.error.flatten() }, { status: 400 })
  }
  const llmRequest = parsedRequest.data

  try {
    const llmResponse = await callStructuredLLM(narrativePrompt(IF_SYSTEM_PROMPT, language), buildIfUserMessage(llmRequest), IfResponseSchema)
    if (!pilihan.some((p) => p.edgeId === llmResponse.edgeId)) {
      return NextResponse.json({ error: 'LLM picked a branch that was not offered' }, { status: 502 })
    }
    return NextResponse.json(llmResponse)
  } catch (e) {
    const { body, status } = llmErrorBody(e, 'Branch decision failed to process')
    return NextResponse.json(body, { status })
  }
}
