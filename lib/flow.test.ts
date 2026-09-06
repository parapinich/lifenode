import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useGraphStore } from './store'
import { useRunStore } from './runStore'
import { useLocaleStore } from './locale'
import { computeGraph, computeOneSegment, executionGraph, validateGraph } from './graph'
import { executeGraph } from './runExecute'
import { post, retryUntilFrom } from './apiPost'
import { segmentActivities } from './mortality'
import { prepareEvent, respondToEvent, eventOccurs } from './randomEvent'
import { nextExample } from './examples'
import { POST } from '../app/api/event/route'
import * as llm from './llm'
import type { RandomEvent } from './schema'

const incident: RandomEvent = { title: 'A forgotten invitation', story: 'A former customer offers you a place at a local fair.', options: [
  { label: 'Join the fair', consequence: 'You reserve a stall and reconnect with a customer.', uang: -50, energi: -5, reputasi: 5, kebahagiaan: 10, skill: [], relasi: [] },
  { label: 'Stay with the shop', consequence: 'You keep your regular customers happy.', uang: 10, energi: 0, reputasi: 1, kebahagiaan: 1, skill: [], relasi: [] },
] }
beforeEach(() => {
  useRunStore.getState().reset()
  useLocaleStore.setState({ language: 'en' })
  useGraphStore.setState({ nodes: [{ id: 'start', kind: 'start', x: 0, y: 0 }, { id: 'end', kind: 'end', x: 700, y: 0 }], edges: [{ id: 'link', from: 'start', to: 'end' }], kondisiAwal: { umur: 20, uang: 1000, latarBelakang: 'A bookseller' }, past: [], future: [] })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('inserts every offered node with one undo and preserves If conditions', () => {
  const store = useGraphStore.getState()
  for (const kind of ['aksi', 'tunggu', 'if', 'event'] as const) {
    expect(store.insertNode('link', kind, 'Read')).toBe(true)
    expect(validateGraph(useGraphStore.getState())).toEqual([])
    store.undo()
    expect(useGraphStore.getState().nodes).toHaveLength(2)
    expect(useGraphStore.getState().edges).toEqual([{ id: 'link', from: 'start', to: 'end' }])
  }
  store.insertNode('link', 'if')
  const branch = useGraphStore.getState().edges.find((e) => e.label)!
  expect(store.insertNode(branch.id, 'tunggu')).toBe(true)
  expect(useGraphStore.getState().edges.find((e) => e.id === branch.id)?.label).toBe(branch.label)
  useRunStore.setState({ lockedNodeIds: [branch.from] })
  expect(store.insertNode(branch.id, 'aksi', 'Edit the past')).toBe(false)
})

it('runs all advanced examples in both languages, along every single If branch', async () => {
  for (const language of ['en', 'id'] as const) for (const random of [0, 0.3, 0.6, 0.99]) {
    const example = nextExample(-1, language, random)
    expect(example.graph.nodes.length).toBeGreaterThanOrEqual(10)
    expect(example.graph.nodes.some((n) => n.kind === 'merge')).toBe(false)
    expect(validateGraph(example.graph)).toEqual([])
    const branches = example.graph.edges.filter((e) => e.from === 'choice')
    for (const branch of branches.length ? branches : [undefined]) {
      useRunStore.getState().reset()
      useLocaleStore.setState({ language })
      useGraphStore.setState({ ...example.graph, kondisiAwal: example.kondisiAwal })
      const visited: string[] = []
      vi.spyOn(Math, 'random').mockReturnValue(0.99)
      vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
        const body = JSON.parse(options.body as string)
        if (url === '/api/branch') return Response.json({ edgeId: branch!.id, narasi: 'A grounded choice.' })
        const playable = executionGraph(body.graph, body.choices)
        const { timing } = computeGraph(playable, body.kondisiAwal.umur)
        const segment = computeOneSegment(playable.nodes, playable.edges, timing, body.fromSyncId)
        if (body.phase === 'assess') return Response.json({ nodes: segmentActivities(playable, segment).map((n) => ({ nodeId: n.id, category: 'safe', annualProbability: 0, reason: 'Ordinary activity.' })), suddenCause: 'An unexpected accident.' })
        visited.push(...segment.nodeIds)
        return Response.json({ narasiSegmen: 'Life moves on.', perNode: segment.nodeIds.map((nodeId) => ({ nodeId, status: 'sukses', teks: nodeId })), narasiGap: [], kejadianPenting: [], stateBaru: { ...body.state, umur: segment.umurSelesai } })
      }))
      for (let step = 0; step < 6 && !useRunStore.getState().chapterComplete; step++) await executeGraph(example.graph.nodes, example.graph.edges, example.kondisiAwal)
      expect(useRunStore.getState().error).toBeNull()
      expect(useRunStore.getState().chapterComplete).toBe(true)
      expect(new Set(visited).size).toBe(visited.length)
      const playable = executionGraph(example.graph, branch ? { choice: branch.id } : {})
      expect(visited.sort()).toEqual(playable.nodes.filter((n) => n.kind === 'aksi').map((n) => n.id).sort())
    }
  }
})

it('persists an event roll on failure, pauses for a choice, and applies it once', async () => {
  const graph = useGraphStore.getState()
  graph.insertNode('link', 'event')
  const id = useGraphStore.getState().nodes.find((n) => n.kind === 'event')!.id
  const state = { umur: 20, uang: 1000, energi: 90, reputasi: 50, kebahagiaan: 95, skill: [], relasi: [], ledger: [], hidup: true }
  useRunStore.setState({ lifeState: state, nextSyncId: id, lockedNodeIds: ['start', id] })
  vi.spyOn(Math, 'random').mockReturnValue(0.1)
  const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(Response.json(incident))
  vi.stubGlobal('fetch', fetch)
  await prepareEvent(id)
  // The cause has to survive to the UI, not collapse into a generic flag.
  expect(useRunStore.getState().events[id].error).toContain('offline')
  vi.spyOn(Math, 'random').mockReturnValue(0.99)
  await prepareEvent(id)
  expect(JSON.parse(fetch.mock.calls[1][1].body).seed).toBe(0.1)
  expect(useRunStore.getState().lifeState).toEqual(state)
  await prepareEvent(id)
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(respondToEvent(id, 100)).toBe(false)
  expect(respondToEvent(id, 0)).toBe(true)
  expect(respondToEvent(id, 0)).toBe(false)
  expect(useRunStore.getState().lifeState).toMatchObject({ uang: 950, energi: 85, kebahagiaan: 100, hidup: true })
  expect(useRunStore.getState().results).toHaveLength(1)
  expect(eventOccurs(0.1, 21, 20)).toBe(false)
  expect(eventOccurs(0.1, 22, 20)).toBe(true)
  expect(eventOccurs(0.99, 25, null)).toBe(false)
})

it('rejects invalid event API requests before calling the narrator', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const response = await POST(new Request('http://localhost/api/event', { method: 'POST', body: JSON.stringify({ seed: -1 }) }))
  expect(response.status).toBe(400)
  expect(fetch).not.toHaveBeenCalled()
})

it('supports parallel decisions on a chosen If branch without creating Merge', () => {
  const store = useGraphStore.getState()
  store.insertNode('link', 'if')
  const branch = useGraphStore.getState().edges.find((e) => e.label)!
  store.addDecision('Ask a friend', 'relasi', branch.to, 'parallel')
  const graph = useGraphStore.getState()
  expect(graph.nodes.some((n) => n.kind === 'merge')).toBe(false)
  expect(validateGraph(graph)).toEqual([])
  const playable = executionGraph(graph, { [branch.from]: branch.id })
  expect(playable.nodes.filter((n) => n.kind === 'aksi')).toHaveLength(2)
  expect(computeOneSegment(playable.nodes, playable.edges, computeGraph(playable, 20).timing, branch.from).nodeIds).toHaveLength(2)
})

it('allows continuing after event failure and enforces the cooldown without another request', async () => {
  useGraphStore.getState().insertNode('link', 'event')
  const id = useGraphStore.getState().nodes.find((n) => n.kind === 'event')!.id
  const state = { umur: 20, uang: 1000, energi: 90, reputasi: 50, kebahagiaan: 95, skill: [], relasi: [], ledger: [], hidup: true }
  useRunStore.setState({ lifeState: state, nextSyncId: id, events: { [id]: { roll: 0.1, error: 'Random event: Rate limited by Groq API' } } })
  expect(respondToEvent(id, 'skip')).toBe(true)
  expect(useRunStore.getState().events[id].skipped).toBe(true)
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  useRunStore.setState({ events: { [id]: { roll: 0.1 } }, lastEventAge: 19 })
  await prepareEvent(id)
  expect(fetch).not.toHaveBeenCalled()
  expect(useRunStore.getState().events[id].skipped).toBe(true)
})

it('builds a contextual event through the API and rejects an incorrect event age', async () => {
  const narrator = vi.spyOn(llm, 'callStructuredLLM').mockResolvedValue(incident)
  useGraphStore.getState().insertNode('link', 'event')
  const { nodes, edges, kondisiAwal } = useGraphStore.getState()
  const body = { graph: { nodes, edges }, kondisiAwal, state: { umur: 20, uang: 1000, energi: 90, reputasi: 50, kebahagiaan: 95, skill: [], relasi: [], ledger: [], hidup: true }, eventNodeId: nodes.find((n) => n.kind === 'event')!.id, seed: 0.1, language: 'id' }
  const response = await POST(new Request('http://localhost/api/event', { method: 'POST', body: JSON.stringify(body) }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(incident)
  expect(narrator.mock.calls[0][0]).toContain('natural Bahasa Indonesia')
  const invalid = await POST(new Request('http://localhost/api/event', { method: 'POST', body: JSON.stringify({ ...body, state: { ...body.state, umur: 90 } }) }))
  expect(invalid.status).toBe(400)
  expect(narrator).toHaveBeenCalledTimes(1)
})

it('keeps the failing stage, the server message and the rate-limit wait', async () => {
  // A fresh Response per call — a body can only be read once.
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Rate limited by Groq API', retryAfter: 42 }, { status: 429 })))
  await expect(post('Risk assessment', '/api/simulate', {})).rejects.toThrow('Risk assessment: Rate limited by Groq API')
  const before = Date.now()
  const failure = await post('Risk assessment', '/api/simulate', {}).catch((e) => e)
  expect(retryUntilFrom(failure)).toBeGreaterThanOrEqual(before + 42_000)

  useLocaleStore.setState({ language: 'id' })
  await expect(post('Risk assessment', '/api/simulate', {})).rejects.toThrow('Penilaian risiko: Rate limited by Groq API')

  // A fault that isn't a rate limit must not park the player behind a countdown.
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: "Unknown sync point 'nope'" }, { status: 400 })))
  const fault = await post('Simulation', '/api/simulate', {}).catch((e: Error) => e)
  expect((fault as Error).message).toBe("Simulasi: Unknown sync point 'nope'")
  expect(retryUntilFrom(fault)).toBeNull()
})

it('will not retry a rate-limited event until the window closes', async () => {
  useGraphStore.getState().insertNode('link', 'event')
  const id = useGraphStore.getState().nodes.find((n) => n.kind === 'event')!.id
  useRunStore.setState({ lifeState: { umur: 20, uang: 1000, energi: 90, reputasi: 50, kebahagiaan: 95, skill: [], relasi: [], ledger: [], hidup: true }, nextSyncId: id })
  vi.spyOn(Math, 'random').mockReturnValue(0.1)
  const fetch = vi.fn(async () => Response.json({ error: 'Rate limited by Groq API', retryAfter: 30 }, { status: 429 }))
  vi.stubGlobal('fetch', fetch)

  await prepareEvent(id)
  expect(useRunStore.getState().events[id].error).toContain('Rate limited by Groq API')
  expect(useRunStore.getState().retryUntil).toBeGreaterThan(Date.now())

  // Clicking again inside the window must not spend another request — that is
  // what kept the limit open and stalled the chapter.
  await prepareEvent(id)
  await prepareEvent(id)
  expect(fetch).toHaveBeenCalledTimes(1)

  useRunStore.setState({ retryUntil: Date.now() - 1 })
  await prepareEvent(id)
  expect(fetch).toHaveBeenCalledTimes(2)
})
