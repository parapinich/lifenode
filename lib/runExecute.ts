import { computeGraph } from './graph'
import { appendLedger, applyDelta } from './engine'
import { useRunStore } from './runStore'
import {
  RingkasanResponseSchema,
  SegmentResponseSchema,
  type Edge,
  type KondisiAwal,
  type LifeNode,
  type LifeState,
} from './schema'

export async function executeGraph(nodes: LifeNode[], edges: Edge[], kondisiAwal: KondisiAwal): Promise<void> {
  const { startRun, setNodeStatus, pushResult, finishRun, fail } = useRunStore.getState()

  const initial: LifeState = {
    umur: kondisiAwal.umur,
    uang: kondisiAwal.uang,
    energi: 100,
    reputasi: 50,
    kebahagiaan: 50,
    skill: [],
    relasi: [],
    ledger: [],
    hidup: true,
  }
  startRun(initial)

  const { segments } = computeGraph({ nodes, edges }, kondisiAwal.umur)
  let state = initial

  for (const segment of segments) {
    for (const nodeId of segment.nodeIds) setNodeStatus(nodeId, 'loading')

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph: { nodes, edges }, kondisiAwal, segmentIndex: segments.indexOf(segment), state }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.error ?? `Call to /api/simulate failed (${res.status})`)
      }
      const parsed = SegmentResponseSchema.parse(await res.json())

      for (const pn of parsed.perNode) setNodeStatus(pn.nodeId, pn.status)

      state = appendLedger(applyDelta(state, parsed.stateBaru), parsed.kejadianPenting)
      pushResult(
        {
          segmentId: segment.id,
          narasiSegmen: parsed.narasiSegmen,
          narasiGap: parsed.narasiGap,
          perNode: parsed.perNode,
        },
        state
      )

      if (!state.hidup) return finishRun()
    } catch (e) {
      for (const nodeId of segment.nodeIds) setNodeStatus(nodeId, 'gagal')
      fail(e instanceof Error ? e.message : 'Segment failed to run')
      return
    }
  }

  finishRun()
}

export async function fetchSummary(kondisiAwal: KondisiAwal, stateAkhir: LifeState): Promise<void> {
  const { requestSummary, setSummary, failSummary } = useRunStore.getState()
  requestSummary()
  try {
    const res = await fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kondisiAwal, stateAkhir }),
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => null)
      throw new Error(detail?.error ?? `Call to /api/summary failed (${res.status})`)
    }
    setSummary(RingkasanResponseSchema.parse(await res.json()))
  } catch (e) {
    failSummary(e instanceof Error ? e.message : 'Summary failed to generate')
  }
}
