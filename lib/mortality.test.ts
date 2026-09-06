import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { decideMortality, RiskAssessmentSchema, segmentActivities, validateAssessment, type RiskAssessment } from './mortality'
import { computeGraph, computeOneSegment, validateGraph } from './graph'
import { GraphSchema, type Graph } from './schema'
import { useRunStore } from './runStore'
import { useGraphStore } from './store'
import { executeGraph } from './runExecute'
import { POST } from '../app/api/simulate/route'
import * as llm from './llm'

const initial = { umur: 20, uang: 1000, latarBelakang: 'Ordinary life' }
const state = { ...initial, energi: 100, reputasi: 50, kebahagiaan: 50, skill: [], relasi: [], ledger: ['An injury still needs recovery.'], hidup: true }
const graph: Graph = {
  nodes: [
    { id: 'start', kind: 'start', x: 0, y: 0 },
    { id: 'work', kind: 'aksi', label: 'Work', lane: 'karir', durasi: 1, x: 300, y: 0 },
    { id: 'fatal', kind: 'aksi', label: 'Unprotected jump from a 50-storey building', lane: 'chaos', durasi: 1, x: 600, y: 0 },
    { id: 'parallel', kind: 'aksi', label: 'Study', lane: 'karir', durasi: 4, x: 300, y: 350 },
    { id: 'later', kind: 'aksi', label: 'Travel', lane: 'chaos', durasi: 30, x: 900, y: 0 },
    { id: 'end', kind: 'end', x: 1200, y: 0 },
  ],
  edges: [ ['start', 'work'], ['work', 'fatal'], ['fatal', 'later'], ['later', 'end'], ['start', 'parallel'], ['parallel', 'end'] ].map(([from, to], i) => ({ id: String(i), from, to })),
}
const assessment: RiskAssessment = { nodes: graph.nodes.filter((n) => n.kind === 'aksi').map((n) => ({ nodeId: n.id, category: n.id === 'fatal' ? 'fatal' : 'safe', annualProbability: 0, reason: n.id === 'fatal' ? 'A fatal fall without protection.' : 'Ordinary activity.' })), suddenCause: 'An unexpected accident during the activity.' }
const clock = { seed: 0.5, exposure: 0 }

beforeEach(() => { useRunStore.getState().reset(); useRunStore.setState({ mortalityClock: clock }); useGraphStore.setState({ ...graph, kondisiAwal: initial }) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('removes the 15-year cap while rejecting invalid durations', () => {
  expect(GraphSchema.safeParse(graph).success).toBe(true)
  expect(validateGraph(graph)).toEqual([])
  for (const durasi of [0, -1, 0.75, Infinity, NaN]) expect(GraphSchema.safeParse({ ...graph, nodes: graph.nodes.map((n) => n.id === 'work' ? { ...n, durasi } : n) }).success).toBe(false)
})

it('fatal action kills at its start after completed predecessors, with no miraculous draw', () => {
  const { timing } = computeGraph(graph, 20)
  expect(decideMortality(assessment, timing, 20, 52, clock).death).toMatchObject({ nodeId: 'fatal', age: 21, category: 'fatal' })
  expect(() => validateAssessment({ ...assessment, nodes: [] }, graph.nodes.filter((n) => n.kind === 'aksi'))).toThrow()
  expect(RiskAssessmentSchema.safeParse({ ...assessment, nodes: [{ ...assessment.nodes[0], annualProbability: 2 }] }).success).toBe(false)
})

it('exposure is invariant under splitting time, checkpoint boundaries and duplicated parallel nodes', () => {
  const single: RiskAssessment = { nodes: [{ nodeId: 'a', category: 'risky', annualProbability: 0.02, reason: 'Activity risk' }], suddenCause: 'Accident' }
  const timing = { a: { umurMulai: 20, umurSelesai: 30 }, b: { umurMulai: 20, umurSelesai: 30 } }
  const whole = decideMortality(single, timing, 20, 30, clock)
  const first = decideMortality(single, timing, 20, 25, clock)
  const second = decideMortality(single, timing, 25, 30, { ...clock, exposure: first.exposure })
  const parallel = decideMortality({ ...single, nodes: [...single.nodes, { ...single.nodes[0], nodeId: 'b' }] }, timing, 20, 30, clock)
  expect(second.exposure).toBeCloseTo(whole.exposure, 12)
  expect(parallel.exposure).toBe(whole.exposure)
  expect(whole.death).toBeNull()
  const riskyClock = { seed: 0.1, exposure: 0 }
  const riskyFirst = decideMortality(single, timing, 20, 25, riskyClock)
  const riskySecond = decideMortality(single, timing, 25, 30, { ...riskyClock, exposure: riskyFirst.exposure })
  expect(riskySecond.death!.age).toBeCloseTo(decideMortality(single, timing, 20, 30, riskyClock).death!.age, 12)
})

it('rare sudden death can happen during a safe wait and is reproducible', () => {
  const safe: RiskAssessment = { nodes: [{ nodeId: 'wait', category: 'safe', annualProbability: 0, reason: 'Rest' }], suddenCause: 'Unexpected medical emergency' }
  const timing = { wait: { umurMulai: 20, umurSelesai: 21 } }
  expect(decideMortality(safe, timing, 20, 21, clock).death).toBeNull()
  const unlucky = { seed: 0.0001, exposure: 0 }
  const result = decideMortality(safe, timing, 20, 21, unlucky)
  expect(result.death).toMatchObject({ nodeId: 'wait', category: 'sudden' })
  expect(result.death!.age).toBeGreaterThan(20)
  expect(result.death!.age).toBeLessThan(21)
  expect(decideMortality(safe, timing, 20, 21, JSON.parse(JSON.stringify(unlucky)))).toEqual(result)
})

it('persists assessment and death across failed narration/reload, stops future actions and blocks continuation', async () => {
  let narrations = 0, assessments = 0
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    const request = JSON.parse(options.body as string)
    if (request.phase === 'assess') { assessments++; return Response.json(assessment) }
    narrations++
    if (narrations === 1) throw new Error('offline')
    return Response.json({ narasiSegmen: 'Life ended after a fatal fall.', perNode: ['work', 'fatal', 'parallel'].map((nodeId) => ({ nodeId, status: 'sukses', teks: nodeId })), narasiGap: [], kejadianPenting: ['Work was completed.'], stateBaru: { ...state, umur: 52, hidup: true } })
  })
  vi.stubGlobal('fetch', fetch)
  await executeGraph(graph.nodes, graph.edges, initial)
  expect(narrations).toBe(0)
  const saved = JSON.parse(JSON.stringify(useRunStore.getState().pendingRisk))
  expect(saved.decision.death.age).toBe(21)
  await executeGraph(graph.nodes, graph.edges, initial)
  expect(useRunStore.getState().error).not.toBeNull()
  useRunStore.setState({ pendingRisk: saved })
  await executeGraph(graph.nodes, graph.edges, initial)
  const run = useRunStore.getState()
  expect(assessments).toBe(1)
  expect(run.lifeState).toMatchObject({ umur: 21, hidup: false })
  expect(run.nodeStatus).toMatchObject({ work: 'sukses', fatal: 'fatal', parallel: 'terhenti', later: 'skipped' })
  expect(run.results).toHaveLength(1)
  expect(run.results[0].death?.nodeId).toBe('fatal')
  expect(run.lifeState!.ledger.join(' ')).toContain('fatal fall')
  await executeGraph(graph.nodes, graph.edges, initial)
  useGraphStore.getState().nextChapter('Revive', 'chaos')
  useGraphStore.getState().addAksiNode('chaos', 'New action', 0, 0)
  expect(useGraphStore.getState().nodes).toEqual(graph.nodes)
  expect(narrations).toBe(2)
})

it('API truncates durations and omits future actions before narration, preserving memory', async () => {
  const narrator = vi.spyOn(llm, 'callStructuredLLM').mockImplementation(async (_system, message) => {
    const payload = JSON.parse(message.split('\n')[1])
    const nodes = payload.cabang.flatMap((c: { nodes: { id: string; durasi: number }[] }) => c.nodes)
    expect(payload.state.ledger).toEqual(state.ledger)
    expect(nodes.find((n: { id: string }) => n.id === 'later')).toBeUndefined()
    expect(nodes.find((n: { id: string }) => n.id === 'parallel').durasi).toBe(1)
    expect(payload.segmen.umurSelesai).toBe(21)
    return { narasiSegmen: 'A fatal fall ends this life.', perNode: nodes.map((n: { id: string }) => ({ nodeId: n.id, status: 'sukses', teks: n.id })), narasiGap: [], kejadianPenting: [], stateBaru: { ...state, umur: 999, hidup: true } }
  })
  const body = { graph, kondisiAwal: initial, fromSyncId: 'start', state, phase: 'simulate', clock, assessment }
  const response = await POST(new Request('http://localhost/api/simulate', { method: 'POST', body: JSON.stringify(body) }))
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(result.stateBaru).toMatchObject({ umur: 21, hidup: false })
  expect(result.perNode.find((n: { nodeId: string }) => n.nodeId === 'parallel').status).toBe('terhenti')
  const invalid = await POST(new Request('http://localhost/api/simulate', { method: 'POST', body: JSON.stringify({ ...body, clock: { seed: -1, exposure: 0 } }) }))
  expect(invalid.status).toBe(400)
  expect(narrator).toHaveBeenCalledTimes(1)
})

it('sudden death during a long wait ends the life before subsequent decisions', async () => {
  const waited: Graph = { nodes: [{ id: 'start', kind: 'start', x: 0, y: 0 }, { id: 'wait', kind: 'tunggu', durasi: 40, x: 300, y: 0 }, { id: 'later', kind: 'aksi', lane: 'karir', label: 'Work later', durasi: 30, x: 600, y: 0 }, { id: 'end', kind: 'end', x: 900, y: 0 }], edges: [['start', 'wait'], ['wait', 'later'], ['later', 'end']].map(([from, to], i) => ({ id: String(i), from, to })) }
  useGraphStore.setState(waited)
  useRunStore.setState({ mortalityClock: { seed: 0.0001, exposure: 0 } })
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
    const request = JSON.parse(options.body as string)
    if (request.phase === 'assess') return Response.json({ nodes: ['wait', 'later'].map((nodeId) => ({ nodeId, category: 'safe', annualProbability: 0, reason: 'Ordinary life.' })), suddenCause: 'An unexpected medical emergency.' })
    return Response.json({ narasiSegmen: 'Life ended while resting.', perNode: [], narasiGap: [], kejadianPenting: [], stateBaru: state })
  }))
  await executeGraph(waited.nodes, waited.edges, initial)
  expect(useRunStore.getState().error).toBeNull()
  expect(useRunStore.getState().nodeStatus).toMatchObject({ wait: 'fatal', later: 'skipped' })
  expect(useRunStore.getState().lifeState?.hidup).toBe(false)
  expect(useRunStore.getState().lifeState!.umur).toBeLessThan(21)
  useRunStore.getState().reset()
  expect(useRunStore.getState().mortalityClock).toBeNull()
  expect(useRunStore.getState().death).toBeNull()
})

it('includes waits in assessment and rejects invalid or missing IDs', () => {
  const waited: Graph = { nodes: [{ id: 'start', kind: 'start', x: 0, y: 0 }, { id: 'wait', kind: 'tunggu', durasi: 40, x: 300, y: 0 }, { id: 'end', kind: 'end', x: 600, y: 0 }], edges: [{ id: 'a', from: 'start', to: 'wait' }, { id: 'b', from: 'wait', to: 'end' }] }
  const { timing } = computeGraph(waited, 20)
  expect(segmentActivities(waited, computeOneSegment(waited.nodes, waited.edges, timing, 'start')).map((n) => n.id)).toEqual(['wait'])
})
