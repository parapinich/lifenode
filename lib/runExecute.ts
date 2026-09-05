import { computeGraph, computeOneSegment, executionGraph, validateGraph } from './graph'
import { appendLedger, applyDelta } from './engine'
import { useRunStore } from './runStore'
import { useHistoryStore } from './historyStore'
import { translate, useLocaleStore } from './locale'
import { GraphSchema, KondisiAwalSchema, IfResponseSchema, RingkasanResponseSchema, SegmentResponseSchema, type Edge, type KondisiAwal, type LifeNode, type LifeState } from './schema'

export async function executeGraph(nodes: LifeNode[], edges: Edge[], kondisiAwal: KondisiAwal): Promise<void> {
  const run = useRunStore.getState()
  if (run.running || run.summaryLoading || run.chapterComplete || run.lifeState?.hidup === false) return
  const language = useLocaleStore.getState().language
  let activeIds: string[] = []
  try {
    GraphSchema.parse({ nodes, edges })
    KondisiAwalSchema.parse(kondisiAwal)
    const issues = validateGraph({ nodes, edges })
    if (issues.length) throw new Error(issues.map((issue) => issue.pesan).join('\n'))
    const start = nodes.find((n) => n.kind === 'start')!
    const initial: LifeState = { umur: kondisiAwal.umur, uang: kondisiAwal.uang, energi: 100, reputasi: 50, kebahagiaan: 50, skill: [], relasi: [], ledger: [], hidup: true }
    if (!run.lifeState) {
      run.startRun(initial)
      useRunStore.setState({ initialConditions: { ...kondisiAwal }, nextSyncId: start.id, lockedNodeIds: [start.id] })
    } else {
      useRunStore.setState({ running: true, error: null, summary: null, summaryError: null })
    }
    const state = useRunStore.getState().lifeState!
    const cursor = useRunStore.getState().nextSyncId ?? start.id
    const choices = { ...run.selectedBranches }
    let branchNarrative: string | undefined = run.branchNarratives[cursor]
    if (nodes.find((n) => n.id === cursor)?.kind === 'if' && !choices[cursor]) {
      const response = await fetch('/api/branch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: { nodes, edges }, kondisiAwal, state, ifNodeId: cursor, language, choices }) })
      if (!response.ok) throw new Error('Branch request failed')
      const choice = IfResponseSchema.parse(await response.json())
      const chosenEdge = edges.find((e) => e.id === choice.edgeId && e.from === cursor)
      if (!chosenEdge) throw new Error('Invalid branch')
      choices[cursor] = choice.edgeId
      useRunStore.setState((s) => ({ selectedBranches: choices, branchNarratives: { ...s.branchNarratives, [cursor]: choice.narasi }, lockedNodeIds: [...new Set([...s.lockedNodeIds, chosenEdge.to])] }))
      branchNarrative = choice.narasi
    }
    const playable = executionGraph({ nodes, edges }, choices)
    const { timing } = computeGraph(playable, kondisiAwal.umur)
    const segment = computeOneSegment(playable.nodes, playable.edges, timing, cursor)
    activeIds = segment.nodeIds
    for (const id of activeIds) run.setNodeStatus(id, 'loading')
    const response = await fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: { nodes, edges }, kondisiAwal, fromSyncId: cursor, state, language, choices }) })
    if (!response.ok) throw new Error('Simulation request failed')
    const result = SegmentResponseSchema.parse(await response.json())
    if (result.perNode.length !== activeIds.length || new Set(result.perNode.map((n) => n.nodeId)).size !== activeIds.length || result.perNode.some((n) => !activeIds.includes(n.nodeId))) throw new Error('Invalid decision outcomes')
    // Time is a game rule, not a number the narrator may improvise.
    const nextState = appendLedger(applyDelta(state, { ...result.stateBaru, umur: segment.umurSelesai }), result.kejadianPenting)
    const visited = new Set([cursor, segment.syncEndId])
    const stack = playable.edges.filter((e) => e.from === cursor).map((e) => e.to)
    while (stack.length) {
      const id = stack.pop()!
      if (visited.has(id)) continue
      visited.add(id)
      for (const e of playable.edges.filter((e) => e.from === id)) stack.push(e.to)
    }
    for (const outcome of result.perNode) run.setNodeStatus(outcome.nodeId, outcome.status)
    for (const node of nodes) {
      if (!playable.nodes.some((n) => n.id === node.id)) { run.setNodeStatus(node.id, 'skipped'); visited.add(node.id) }
    }
    run.pushResult({ segmentId: `${run.results.length}:${segment.id}`, narasiSegmen: result.narasiSegmen, narasiGap: result.narasiGap, perNode: result.perNode, branchNarrative }, nextState)
    useRunStore.setState((s) => ({ nextSyncId: segment.syncEndId, lockedNodeIds: [...new Set([...s.lockedNodeIds, ...visited])], chapterComplete: nodes.find((n) => n.id === segment.syncEndId)?.kind === 'end' || !nextState.hidup }))
    run.finishRun()
  } catch {
    for (const id of activeIds) run.setNodeStatus(id, 'idle')
    run.fail(translate(language, 'Something went wrong. Your progress is saved; try again.'))
  }
}

export async function fetchSummary(kondisiAwal: KondisiAwal, stateAkhir: LifeState): Promise<void> {
  const run = useRunStore.getState()
  if (run.running || run.summaryLoading) return
  const language = useLocaleStore.getState().language
  const initial = run.initialConditions ?? kondisiAwal
  run.requestSummary()
  try {
    const res = await fetch('/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kondisiAwal: initial, stateAkhir, language }) })
    if (!res.ok) throw new Error('Summary request failed')
    const summary = RingkasanResponseSchema.parse(await res.json())
    run.setSummary(summary)
    useHistoryStore.getState().addEntry({ kondisiAwal: initial, stateAkhir, summary })
  } catch {
    run.failSummary(translate(language, 'Something went wrong. Your progress is saved; try again.'))
  }
}
