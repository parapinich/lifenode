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
import { decideMortality, livedActionIds, MortalityClockSchema, RiskAssessmentSchema, RISK_PROMPT, segmentActivities, validateAssessment } from '@/lib/mortality'

const RequestSchema = z.object({
  phase: z.enum(['assess', 'simulate']),
  clock: MortalityClockSchema,
  assessment: RiskAssessmentSchema.optional(),
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
  const { graph, kondisiAwal, fromSyncId, state, language, choices, phase, clock } = parsed.data

  // The server doesn't trust the client's math — recompute from the raw graph.
  // Graph validation limits narrative checkpoints; risk assessment precedes narration.
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

  if (!timing[fromSyncId] || !playable.nodes.some((n) => n.id === fromSyncId && ['start', 'merge', 'if', 'event'].includes(n.kind))) {
    return NextResponse.json({ error: `Unknown sync point '${fromSyncId}'` }, { status: 400 })
  }

  let segment
  try {
    segment = computeOneSegment(playable.nodes, playable.edges, timing, fromSyncId)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to compute segment' }, { status: 400 })
  }

  const cabang = segmentCabang(segment, playable.nodes, playable.edges, timing)
  if (!state.hidup || state.umur !== segment.umurMulai) return NextResponse.json({ error: 'Invalid life cursor' }, { status: 400 })
  const activities = segmentActivities(playable, segment)
  if (phase === 'assess') {
    if (!activities.length) return NextResponse.json({ nodes: [], suddenCause: language === 'id' ? 'Tidak ada waktu berlalu.' : 'No time elapsed.' })
    try {
      const assessment = await callStructuredLLM(narrativePrompt(RISK_PROMPT, language), JSON.stringify({ state, activities: activities.map((n) => ({ ...n, ...timing[n.id] })) }), RiskAssessmentSchema)
      validateAssessment(assessment, activities)
      return NextResponse.json(assessment)
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Risk assessment failed' }, { status: 502 })
    }
  }
  let decision
  try {
    if (!parsed.data.assessment) throw new Error('Missing risk assessment')
    validateAssessment(parsed.data.assessment, activities)
    decision = decideMortality(parsed.data.assessment, timing, segment.umurMulai, segment.umurSelesai, clock)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Invalid risk assessment' }, { status: 400 })
  }
  const death = decision.death
  const endAge = death?.age ?? segment.umurSelesai
  const livedIds = livedActionIds(activities, timing, decision)
  const livedBranches = cabang.map((c) => ({ ...c, gapTahun: Math.min(c.gapTahun, endAge - segment.umurMulai), nodes: c.nodes.filter((n) => livedIds.includes(n.id)).map((n) => ({ ...n, durasi: Math.max(0, Math.min(timing[n.id].umurSelesai, endAge) - timing[n.id].umurMulai), umurSelesai: Math.min(timing[n.id].umurSelesai, endAge) })) }))
  const lamaSegmen = endAge - segment.umurMulai
  const kepadatan = hitungKepadatan(livedBranches, lamaSegmen)

  const parsedRequest = SegmentRequestSchema.safeParse({
    segmen: { id: segment.id, umurMulai: segment.umurMulai, umurSelesai: endAge },
    state,
    cabang: livedBranches,
    kepadatan,
  })
  if (!parsedRequest.success) {
    return NextResponse.json({ error: 'Failed to build segment request', detail: parsedRequest.error.flatten() }, { status: 400 })
  }
  const llmRequest = parsedRequest.data

  try {
    const mortalityInstructions = `\nEngine outcome is binding: ${JSON.stringify(death)}. If null, the character survives; never narrate death. Otherwise the character dies at the supplied age from the supplied cause; no rescue, revival or later events. Narrate only supplied elapsed durations. Ongoing activities end incomplete. Retain persistent injuries, recovery, losses and commitments in kejadianPenting for later decisions. On death write a factual ending, without a next decision. The cause may be a wait outside perNode; include it in the narrative. No achievements during zero elapsed time.`
    const llmResponse = await callStructuredLLM(narrativePrompt(SYSTEM_PROMPT + mortalityInstructions, language), buildSegmentUserMessage(llmRequest), SegmentResponseSchema)
    if (llmResponse.perNode.length !== livedIds.length || new Set(llmResponse.perNode.map((n) => n.nodeId)).size !== livedIds.length || llmResponse.perNode.some((n) => !livedIds.includes(n.nodeId))) {
      return NextResponse.json({ error: 'Invalid decision outcomes' }, { status: 502 })
    }
    llmResponse.stateBaru.umur = endAge
    llmResponse.stateBaru.hidup = !death
    if (endAge === state.umur) llmResponse.stateBaru = { ...state, umur: endAge, hidup: !death }
    for (const outcome of llmResponse.perNode) {
      if (outcome.nodeId === death?.nodeId) outcome.status = 'fatal'
      else if (death && timing[outcome.nodeId].umurSelesai > death.age) outcome.status = 'terhenti'
      else if (outcome.status === 'fatal' || outcome.status === 'terhenti') throw new Error('Unexpected terminal outcome')
    }
    return NextResponse.json(llmResponse)
  } catch (e) {
    if (e instanceof LLMError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Segment failed to process' }, { status: 502 })
  }
}
