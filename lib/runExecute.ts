import { computeGraph, computeOneSegment } from './graph'
import { appendLedger, applyDelta } from './engine'
import { useRunStore, type NodeRunStatus } from './runStore'
import { useHistoryStore } from './historyStore'
import {
  IfResponseSchema,
  RingkasanResponseSchema,
  SegmentResponseSchema,
  type Edge,
  type KondisiAwal,
  type LifeNode,
  type LifeState,
} from './schema'

/** Tandai semua node di cabang-cabang if yang NGGAK kepilih sebagai 'skipped'.
 * Berhenti begitu ketemu sync point (merge/if/end) — itu titik reconvergence,
 * bisa aja masih kepakai lewat jalur yang beneran jalan (lihat CLAUDE.md §2,
 * cabang selalu ketemu lagi di satu titik sync yang sama). */
function markSkipped(
  ifNodeId: string,
  chosenEdgeId: string,
  nodes: LifeNode[],
  edges: Edge[],
  setNodeStatus: (id: string, status: NodeRunStatus) => void
): void {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = new Map<string, Edge[]>()
  for (const n of nodes) outgoing.set(n.id, [])
  for (const e of edges) outgoing.get(e.from)?.push(e)

  const seen = new Set<string>()
  const stack = (outgoing.get(ifNodeId) ?? []).filter((e) => e.id !== chosenEdgeId).map((e) => e.to)
  while (stack.length > 0) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    const node = byId.get(id)
    if (!node || node.kind === 'merge' || node.kind === 'if' || node.kind === 'end') continue
    setNodeStatus(id, 'skipped')
    for (const e of outgoing.get(id) ?? []) stack.push(e.to)
  }
}

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

  const startNode = nodes.find((n) => n.kind === 'start')
  const endNode = nodes.find((n) => n.kind === 'end')
  if (!startNode || !endNode) return fail('Graph is missing a start or end node')

  const byId = new Map(nodes.map((n) => [n.id, n]))
  let timing
  try {
    timing = computeGraph({ nodes, edges }, kondisiAwal.umur).timing
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Failed to compute graph timing')
  }

  let state = initial
  let currentSyncId = startNode.id

  // Jalan inkremental: hitung SATU segmen dari posisi sekarang, jalanin, terus
  // maju ke sync point berikutnya. Beda dari model lama (segments dihitung
  // penuh di depan) — di sini jalurnya baru ketauan pas node if mutusin cabang.
  while (currentSyncId !== endNode.id) {
    const segment = computeOneSegment(nodes, edges, timing, currentSyncId)
    for (const nodeId of segment.nodeIds) setNodeStatus(nodeId, 'loading')

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph: { nodes, edges }, kondisiAwal, fromSyncId: currentSyncId, state }),
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

    const syncNode = byId.get(segment.syncEndId)!
    if (syncNode.kind === 'end') break
    if (syncNode.kind === 'merge') {
      currentSyncId = syncNode.id
      continue
    }

    // syncNode.kind === 'if': satu call tambahan buat mutusin cabang mana yang kejadian.
    setNodeStatus(syncNode.id, 'loading')
    try {
      const res = await fetch('/api/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph: { nodes, edges }, kondisiAwal, state, ifNodeId: syncNode.id }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.error ?? `Call to /api/branch failed (${res.status})`)
      }
      const parsed = IfResponseSchema.parse(await res.json())
      const chosenEdge = edges.find((e) => e.id === parsed.edgeId && e.from === syncNode.id)
      if (!chosenEdge) throw new Error('LLM picked a branch that does not exist')

      setNodeStatus(syncNode.id, 'sukses')
      markSkipped(syncNode.id, chosenEdge.id, nodes, edges, setNodeStatus)
      currentSyncId = chosenEdge.to
    } catch (e) {
      setNodeStatus(syncNode.id, 'gagal')
      fail(e instanceof Error ? e.message : 'Branch decision failed')
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
    const summary = RingkasanResponseSchema.parse(await res.json())
    setSummary(summary)
    useHistoryStore.getState().addEntry({ kondisiAwal, stateAkhir, summary })
  } catch (e) {
    failSummary(e instanceof Error ? e.message : 'Summary failed to generate')
  }
}
