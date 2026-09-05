import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { computeGraph, computeOneSegment, executionGraph, validateGraph } from './graph'
import { nextExample } from './examples'
import { useGraphStore } from './store'
import { useRunStore } from './runStore'
import { useLocaleStore, translate, formatMoney } from './locale'
import { executeGraph } from './runExecute'
import { narrativePrompt, SYSTEM_PROMPT } from './prompts'
import type { Graph } from './schema'

beforeEach(() => {
  useRunStore.getState().reset()
  useLocaleStore.setState({ language: 'en' })
  useGraphStore.setState({ nodes: [{ id: 'start', kind: 'start', x: 0, y: 0 }, { id: 'end', kind: 'end', x: 700, y: 0 }], edges: [], past: [], future: [], kondisiAwal: { umur: 20, uang: 1000, latarBelakang: 'A quiet life' } })
})
afterEach(() => vi.unstubAllGlobals())

it('formats money without converting stored amounts', () => {
  for (const [value, en, id] of [[100000, '$100,000', 'Rp100.000'], [0, '$0', 'Rp0'], [-1250.5, '-$1,250.5', '-Rp1.250,5']] as const) {
    expect(formatMoney(value, 'en')).toBe(en)
    expect(formatMoney(value, 'id')).toBe(id)
  }
  const funds = useGraphStore.getState().kondisiAwal.uang
  useLocaleStore.getState().setLanguage('id')
  expect(useGraphStore.getState().kondisiAwal.uang).toBe(funds)
  expect(narrativePrompt('', 'en')).toContain('dollars ($)')
  expect(narrativePrompt('', 'id')).toContain('Rupiah (Rp)')
})

it('deletes a group and its connections in one undo while retaining endpoints', () => {
  const store = useGraphStore.getState()
  store.addDecision('Work', 'karir')
  const first = useGraphStore.getState().nodes.find((n) => n.kind === 'aksi')!
  store.addDecision('Rest', 'kesehatan', first.id, 'after')
  const before = useGraphStore.getState()
  store.removeElements(before.nodes.map((n) => n.id), before.edges.map((e) => e.id))
  expect(useGraphStore.getState().nodes.map((n) => n.id)).toEqual(['start', 'end'])
  expect(useGraphStore.getState().edges).toEqual([])
  expect(useGraphStore.getState().past.length).toBe(before.past.length + 1)
  store.undo()
  expect(useGraphStore.getState().nodes).toEqual(before.nodes)
  expect(useGraphStore.getState().edges).toEqual(before.edges)
  useRunStore.setState({ lockedNodeIds: [first.id] })
  store.removeElements([first.id], [before.edges[0].id])
  expect(useGraphStore.getState().nodes).toContainEqual(first)
  expect(useGraphStore.getState().edges).toContainEqual(before.edges[0])
  useRunStore.setState({ running: true })
  const busy = useGraphStore.getState()
  store.removeElements(busy.nodes.map((n) => n.id), busy.edges.map((e) => e.id))
  expect(useGraphStore.getState().nodes).toEqual(busy.nodes)
  expect(useGraphStore.getState().edges).toEqual(busy.edges)
})

it('rotates bilingual examples without immediate repeats; every graph is playable', () => {
  for (const language of ['en', 'id'] as const) {
    let previous = -1
    for (const random of [0, 0, 0.99, 0.5, 0.1]) {
      const example = nextExample(previous, language, random)
      expect(example.index).not.toBe(previous)
      expect(validateGraph(example.graph)).toEqual([])
      expect(computeGraph(example.graph, example.kondisiAwal.umur).timing.end.umurMulai).toBeGreaterThan(example.kondisiAwal.umur)
      previous = example.index
    }
  }
  expect(nextExample(-1, 'id', 0).graph.nodes[1].label).not.toBe(nextExample(-1, 'en', 0).graph.nodes[1].label)
})

it('connects free decisions sequentially and in parallel, with half-year durations', () => {
  const store = useGraphStore.getState()
  store.addDecision('Open a bookshop', 'karir')
  const first = useGraphStore.getState().nodes.find((n) => n.kind === 'aksi')!
  store.updateNode(first.id, { durasi: 0.5 })
  store.addDecision('Learn to surf', 'kesehatan', first.id, 'parallel')
  let graph = useGraphStore.getState()
  expect(validateGraph(graph)).toEqual([])
  expect(computeGraph(graph, 20).timing.end.umurMulai).toBe(21)
  store.addDecision('Run a reading club', 'relasi', first.id, 'after')
  graph = useGraphStore.getState()
  expect(validateGraph(graph)).toEqual([])
  expect(computeGraph(graph, 20).timing.end.umurMulai).toBe(21.5)
  store.updateNode(first.id, { durasi: 0 })
  expect(validateGraph(useGraphStore.getState()).length).toBeGreaterThan(0)
})

function mockNarrator() {
  return vi.fn(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string)
    const graph = executionGraph(body.graph, body.choices ?? {})
    const { timing } = computeGraph(graph, body.kondisiAwal.umur)
    const segment = computeOneSegment(graph.nodes, graph.edges, timing, body.fromSyncId)
    return Response.json({ narasiSegmen: 'The bookshop found its readers.', narasiGap: [], perNode: segment.nodeIds.map((nodeId) => ({ nodeId, status: 'sukses', teks: 'Readers arrived.', alasan: 'You opened regularly.' })), stateBaru: { ...body.state, umur: 99, uang: body.state.uang + 100 }, kejadianPenting: ['The bookshop has regular readers.'] })
  })
}

it('keeps wait and conditional connections valid when adding a parallel decision', () => {
  const graph: Graph = {
    nodes: [{ id: 'start', kind: 'start', x: 0, y: 0 }, { id: 'before', kind: 'tunggu', durasi: 1, x: 200, y: 0 }, { id: 'a', kind: 'aksi', lane: 'karir', label: 'Work', durasi: 1, x: 400, y: 0 }, { id: 'after', kind: 'tunggu', durasi: 1, x: 700, y: 0 }, { id: 'end', kind: 'end', x: 900, y: 0 }],
    edges: [{ id: '1', from: 'start', to: 'before' }, { id: '2', from: 'before', to: 'a' }, { id: '3', from: 'a', to: 'after' }, { id: '4', from: 'after', to: 'end' }],
  }
  useGraphStore.setState(graph)
  useGraphStore.getState().addDecision('Rest', 'kesehatan', 'a', 'parallel')
  const updated = useGraphStore.getState()
  expect(validateGraph(updated)).toEqual([])
  expect(computeGraph(updated, 20).timing.end.umurMulai).toBe(23)
  expect(updated.nodes.filter((n) => n.kind === 'merge')).toHaveLength(2)
})

it('retains state and memory across chapters, locks lived decisions, and propagates language', async () => {
  useGraphStore.getState().addDecision('Open a bookshop', 'karir')
  const graph = useGraphStore.getState()
  const fetch = mockNarrator()
  vi.stubGlobal('fetch', fetch)
  useLocaleStore.setState({ language: 'id' })
  await executeGraph(graph.nodes, graph.edges, graph.kondisiAwal)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(useRunStore.getState().lifeState?.umur).toBe(21)
  expect(useRunStore.getState().chapterComplete).toBe(true)
  const first = graph.nodes.find((n) => n.kind === 'aksi')!
  graph.removeNode(first.id)
  graph.updateNode(first.id, { label: 'Changed past' })
  graph.undo()
  expect(useGraphStore.getState().nodes).toEqual(graph.nodes)
  graph.nextChapter('Invite the regular readers to a picnic', 'relasi')
  const next = useGraphStore.getState()
  await executeGraph(next.nodes, next.edges, next.kondisiAwal)
  const request = JSON.parse(fetch.mock.calls[1][1].body as string)
  expect(request.language).toBe('id')
  expect(request.state.ledger).toEqual(['The bookshop has regular readers.'])
  expect(request.state.uang).toBe(1100)
  expect(useRunStore.getState().lifeState?.umur).toBe(22)
  expect(useRunStore.getState().results).toHaveLength(2)
  expect(useRunStore.getState().initialConditions?.umur).toBe(20)
})

it('pauses at a checkpoint; retry does not replay previous results', async () => {
  const example = nextExample(-1, 'en', 0)
  const graph: Graph = {
    nodes: [...example.graph.nodes.filter((n) => n.id !== 'end'), { id: 'merge', kind: 'merge', x: 0, y: 0 }, { id: 'later', kind: 'aksi', lane: 'relasi', label: 'Meet a friend', durasi: 1, x: 0, y: 0 }, { id: 'end', kind: 'end', x: 0, y: 0 }],
    edges: [...example.graph.edges.map((e) => e.to === 'end' ? { ...e, to: 'merge' } : e), { id: 'next', from: 'merge', to: 'later' }, { id: 'finish', from: 'later', to: 'end' }],
  }
  const fetch = mockNarrator()
  vi.stubGlobal('fetch', fetch)
  await executeGraph(graph.nodes, graph.edges, example.kondisiAwal)
  expect(useRunStore.getState().nextSyncId).toBe('merge')
  expect(useRunStore.getState().chapterComplete).toBe(false)
  fetch.mockRejectedValueOnce(new Error('offline'))
  await executeGraph(graph.nodes, graph.edges, example.kondisiAwal)
  expect(useRunStore.getState().results).toHaveLength(1)
  expect(useRunStore.getState().nextSyncId).toBe('merge')
  await executeGraph(graph.nodes, graph.edges, example.kondisiAwal)
  expect(useRunStore.getState().results).toHaveLength(2)
  expect(useRunStore.getState().chapterComplete).toBe(true)
})

it('includes the first selected branch decision and retries without rerolling the choice', async () => {
  const graph: Graph = {
    nodes: [{ id: 'start', kind: 'start', x: 0, y: 0 }, { id: 'if', kind: 'if', x: 0, y: 0 }, { id: 'short', kind: 'aksi', lane: 'karir', label: 'Try it', durasi: 0.5, x: 0, y: 0 }, { id: 'long', kind: 'aksi', lane: 'karir', label: 'Study', durasi: 10, x: 0, y: 0 }, { id: 'end', kind: 'end', x: 0, y: 0 }],
    edges: [{ id: 's', from: 'start', to: 'if' }, { id: 'yes', from: 'if', to: 'short', label: 'yes' }, { id: 'no', from: 'if', to: 'long', label: 'no' }, { id: 'a', from: 'short', to: 'end' }, { id: 'b', from: 'long', to: 'end' }],
  }
  const playable = executionGraph(graph, { if: 'yes' })
  const { timing } = computeGraph(playable, 20)
  expect(computeOneSegment(playable.nodes, playable.edges, timing, 'if').nodeIds).toEqual(['short'])
  expect(timing.end.umurMulai).toBe(20.5)
  expect(() => executionGraph(graph, { if: 'missing' })).toThrow()
  useGraphStore.setState(graph)
  let branchCalls = 0
  let failed = false
  const narrator = mockNarrator()
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    if (url === '/api/branch') {
      branchCalls++
      return Response.json({ edgeId: 'yes', narasi: 'You chose to try it first.' })
    }
    if (JSON.parse(options.body as string).choices.if && !failed) { failed = true; throw new Error('offline') }
    return narrator(url, options)
  }))
  const initial = useGraphStore.getState().kondisiAwal
  await executeGraph(graph.nodes, graph.edges, initial)
  await executeGraph(graph.nodes, graph.edges, initial)
  useGraphStore.getState().removeNode('short')
  useGraphStore.getState().removeEdge('yes')
  expect(useGraphStore.getState().nodes.some((n) => n.id === 'short')).toBe(true)
  expect(useGraphStore.getState().edges.some((e) => e.id === 'yes')).toBe(true)
  await executeGraph(graph.nodes, graph.edges, initial)
  expect(branchCalls).toBe(1)
  expect(useRunStore.getState().lifeState?.umur).toBe(20.5)
  expect(useRunStore.getState().results[1].branchNarrative).toBe('You chose to try it first.')
  expect(useRunStore.getState().results[1].perNode.map((n) => n.nodeId)).toEqual(['short'])
  expect(useRunStore.getState().nodeStatus.long).toBe('skipped')
})

it('localizes UI and narration while preserving protocol enums', () => {
  expect(translate('id', 'After this')).toBe('Setelah ini')
  expect(narrativePrompt(SYSTEM_PROMPT, 'id')).toContain('natural Bahasa Indonesia')
  expect(narrativePrompt(SYSTEM_PROMPT, 'en')).toContain('English')
  expect(narrativePrompt(SYSTEM_PROMPT, 'id')).toContain('enum values unchanged')
})
