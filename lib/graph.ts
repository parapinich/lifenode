import type { Cabang, Edge, Graph, Lane, LifeNode, ValidationIssue } from './schema'

export class GraphCycleError extends Error {
  constructor() {
    super('Graph contains a cycle')
  }
}

/** Kahn's algorithm. Melempar GraphCycleError kalau ada siklus. */
export function topologicalSort(nodes: LifeNode[], edges: Edge[]): string[] {
  const indegree = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  for (const n of nodes) {
    indegree.set(n.id, 0)
    outgoing.set(n.id, [])
  }
  for (const e of edges) {
    if (!outgoing.has(e.from) || !indegree.has(e.to)) continue
    outgoing.get(e.from)!.push(e.to)
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1)
  }

  const queue = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id)
  const order: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const next of outgoing.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1
      indegree.set(next, remaining)
      if (remaining === 0) queue.push(next)
    }
  }

  if (order.length !== nodes.length) throw new GraphCycleError()
  return order
}

// Hard limit CLAUDE.md §5: max 5 Merge -> max 6 LLM call per run (excludes the
// separate summary call). A Merge costs 1 call (the segment starting there);
// an If costs 2 (its own branch-decision call, plus the segment starting at
// whichever branch gets chosen). Validated from the graph's WORST-CASE path —
// server never trusts which branch the LLM will actually pick at runtime.
export const MAX_LLM_CALLS = 6

export function worstCaseCallCount(graph: Graph): number {
  const { nodes, edges } = graph
  const order = topologicalSort(nodes, edges)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, Edge[]>()
  for (const n of nodes) incoming.set(n.id, [])
  for (const e of edges) incoming.get(e.to)?.push(e)

  const pathCost: Record<string, number> = {}
  for (const id of order) {
    const node = byId.get(id)!
    const own = node.kind === 'if' ? 2 : node.kind === 'merge' ? 1 : 0
    const inEdges = incoming.get(id) ?? []
    const maxPred = inEdges.length > 0 ? Math.max(...inEdges.map((e) => pathCost[e.from] ?? 0)) : 0
    pathCost[id] = own + maxPred
  }

  const end = nodes.find((n) => n.kind === 'end')
  return (end ? pathCost[end.id] : 0) + 1
}

export function validateGraph(graph: Graph): ValidationIssue[] {
  const { nodes, edges } = graph
  const issues: ValidationIssue[] = []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, Edge[]>()
  const outgoingEdges = new Map<string, Edge[]>()
  for (const n of nodes) {
    incoming.set(n.id, [])
    outgoingEdges.set(n.id, [])
  }
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue
    incoming.get(e.to)?.push(e)
    outgoingEdges.get(e.from)?.push(e)
  }

  const starts = nodes.filter((n) => n.kind === 'start')
  const ends = nodes.filter((n) => n.kind === 'end')
  if (starts.length !== 1) issues.push({ nodeId: '', pesan: `Graph needs exactly one start node, found ${starts.length}` })
  if (ends.length !== 1) issues.push({ nodeId: '', pesan: `Graph needs exactly one end node, found ${ends.length}` })

  for (const n of nodes) {
    const label = n.label ?? n.id
    if (n.kind === 'merge' && (incoming.get(n.id)?.length ?? 0) < 2) {
      issues.push({ nodeId: n.id, pesan: `Node '${label}' needs at least 2 incoming connections to be a Merge` })
    }
    if (n.kind === 'aksi') {
      if (!n.label) issues.push({ nodeId: n.id, pesan: `Step node '${n.id}' is missing a label` })
    }
    if (n.kind === 'tunggu') {
      if (!n.durasi) issues.push({ nodeId: n.id, pesan: `Wait node '${n.id}' is missing a duration` })
      if ((incoming.get(n.id)?.length ?? 0) !== 1) {
        issues.push({ nodeId: n.id, pesan: `Wait node '${label}' needs exactly 1 incoming connection` })
      }
      if ((outgoingEdges.get(n.id)?.length ?? 0) !== 1) {
        issues.push({ nodeId: n.id, pesan: `Wait node '${label}' needs exactly 1 outgoing connection` })
      }
    }
    if (n.kind === 'if') {
      const outs = outgoingEdges.get(n.id) ?? []
      if ((incoming.get(n.id)?.length ?? 0) !== 1) {
        issues.push({ nodeId: n.id, pesan: `If node '${label}' needs exactly 1 incoming connection` })
      }
      if (outs.length < 2) {
        issues.push({ nodeId: n.id, pesan: `If node '${label}' needs at least 2 outgoing branches` })
      }
      if (outs.some((e) => !e.label)) {
        issues.push({ nodeId: n.id, pesan: `Every branch out of If node '${label}' needs a condition label` })
      }
    }
  }

  let order: string[] | null = null
  try {
    order = topologicalSort(nodes, edges)
  } catch {
    issues.push({ nodeId: '', pesan: 'Graph contains a cycle' })
  }

  if (order && starts.length === 1 && ends.length === 1) {
    const worst = worstCaseCallCount(graph)
    if (worst > MAX_LLM_CALLS) {
      issues.push({
        nodeId: '',
        pesan: `Graph's worst-case path needs up to ${worst} LLM calls, but the limit is ${MAX_LLM_CALLS} per run`,
      })
    }
  }

  if (order && starts.length === 1) {
    const startId = starts[0].id
    const reachableFromStart = reachableForward(startId, nodes, edges)
    for (const n of nodes) {
      if (n.id === startId) continue
      if (!reachableFromStart.has(n.id)) {
        issues.push({ nodeId: n.id, pesan: `Node '${n.label ?? n.id}' isn't connected to start` })
      }
    }
  }

  if (order && ends.length === 1) {
    const endId = ends[0].id
    const canReachEnd = reachableBackward(endId, nodes, edges)
    for (const n of nodes) {
      if (n.id === endId) continue
      if (!canReachEnd.has(n.id)) {
        issues.push({ nodeId: n.id, pesan: `Node '${n.label ?? n.id}' has no path to end` })
      }
    }
  }

  return issues
}

function reachableForward(fromId: string, nodes: LifeNode[], edges: Edge[]): Set<string> {
  const adjacency = new Map<string, string[]>()
  for (const n of nodes) adjacency.set(n.id, [])
  for (const e of edges) adjacency.get(e.from)?.push(e.to)
  const seen = new Set<string>([fromId])
  const stack = [fromId]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const next of adjacency.get(id) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        stack.push(next)
      }
    }
  }
  return seen
}

function reachableBackward(fromId: string, nodes: LifeNode[], edges: Edge[]): Set<string> {
  const reverse = new Map<string, string[]>()
  for (const n of nodes) reverse.set(n.id, [])
  for (const e of edges) reverse.get(e.to)?.push(e.from)
  const seen = new Set<string>([fromId])
  const stack = [fromId]
  while (stack.length > 0) {
    const id = stack.pop()!
    for (const prev of reverse.get(id) ?? []) {
      if (!seen.has(prev)) {
        seen.add(prev)
        stack.push(prev)
      }
    }
  }
  return seen
}

export interface NodeTiming {
  umurMulai: number
  umurSelesai: number
}

export interface MergeGap {
  mergeId: string
  fromNodeId: string
  gapTahun: number
}

export interface Segment {
  id: string
  syncStartId: string
  syncEndId: string
  umurMulai: number
  umurSelesai: number
  nodeIds: string[]
}

export interface GraphComputation {
  order: string[]
  timing: Record<string, NodeTiming>
  gaps: MergeGap[]
  segments: Segment[]
}

/** Graf harus sudah lolos validateGraph sebelum dipanggil. */
export function computeGraph(graph: Graph, umurAwal: number): GraphComputation {
  const { nodes, edges } = graph
  const order = topologicalSort(nodes, edges)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, Edge[]>()
  for (const n of nodes) incoming.set(n.id, [])
  for (const e of edges) incoming.get(e.to)?.push(e)

  const timing: Record<string, NodeTiming> = {}
  const gaps: MergeGap[] = []

  for (const id of order) {
    const node = byId.get(id)!
    const inEdges = incoming.get(id) ?? []
    if (node.kind === 'start') {
      timing[id] = { umurMulai: umurAwal, umurSelesai: umurAwal }
    } else if (node.kind === 'merge') {
      const umurMulai = Math.max(...inEdges.map((e) => timing[e.from].umurSelesai))
      timing[id] = { umurMulai, umurSelesai: umurMulai }
      for (const e of inEdges) {
        gaps.push({ mergeId: id, fromNodeId: e.from, gapTahun: umurMulai - timing[e.from].umurSelesai })
      }
    } else {
      // aksi / tunggu / end: tepat satu kabel masuk (graf sudah divalidasi).
      // aksi selalu instan (durasi 0) — durasi cuma lewat node tunggu.
      const umurMulai = timing[inEdges[0].from].umurSelesai
      const durasi = node.kind === 'tunggu' ? (node.durasi ?? 0) : 0
      timing[id] = { umurMulai, umurSelesai: umurMulai + durasi }
    }
  }

  const segments = computeSegments(nodes, edges, timing)
  return { order, timing, gaps, segments }
}

/**
 * Versi single-hop dari computeSegments: jalan dari SATU sync point (start,
 * merge, atau if yang cabangnya udah kepilih), kumpulin node aksi sampe
 * ketemu sync point berikutnya. Dipakai runExecute.ts buat eksekusi
 * inkremental — beda dari computeSegments yang hitung seluruh graf statis di
 * depan, ini nunggu tiap keputusan if baru jalan ke langkah berikutnya.
 * Caller yang nentuin `edges` mana yang boleh dilewati (buat node if, cabang
 * yang nggak kepilih harus difilter keluar dulu sebelum manggil ini).
 */
export function computeOneSegment(
  nodes: LifeNode[],
  edges: Edge[],
  timing: Record<string, NodeTiming>,
  fromSyncId: string
): Segment {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = new Map<string, Edge[]>()
  for (const n of nodes) outgoing.set(n.id, [])
  for (const e of edges) outgoing.get(e.from)?.push(e)

  const nodeIds: string[] = []
  let syncEndId: string | undefined
  const seen = new Set<string>()
  const stack = (outgoing.get(fromSyncId) ?? []).map((e) => e.to)
  while (stack.length > 0) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    const node = byId.get(id)!
    if (node.kind === 'merge' || node.kind === 'if' || node.kind === 'end') {
      syncEndId = id
      continue
    }
    if (node.kind === 'aksi') nodeIds.push(id)
    for (const e of outgoing.get(id) ?? []) stack.push(e.to)
  }

  if (!syncEndId) throw new Error(`No sync point reachable from '${fromSyncId}'`)

  return {
    id: `seg:${fromSyncId}`,
    syncStartId: fromSyncId,
    syncEndId,
    umurMulai: timing[fromSyncId].umurSelesai,
    umurSelesai: timing[syncEndId].umurMulai,
    nodeIds,
  }
}

/**
 * Kelompokin node aksi ke segmen berdasarkan sync point (start/merge/if)
 * terdekat di belakangnya. Ini buat preview statis doang (age di canvas,
 * autoLayout) — eksekusi beneran pakai computeOneSegment yang jalan
 * inkremental, soalnya cabang mana yang diambil di node if baru ketauan pas
 * runtime. ponytail: kalau satu node aksi/if bercabang ke dua sync point yang
 * beda sebelum ada sync point lain di antaranya, segmen preview ditentukan
 * dari sync point paling awal yang ditemukan pas nodes-nya diproses — kasus
 * itu di luar cakupan MVP (lihat CLAUDE.md §2, cabang selalu ketemu lagi di
 * satu Merge; sama-sama berlaku buat If, tiap cabangnya diasumsikan nyatu
 * balik di satu sync point yang sama).
 */
function computeSegments(
  nodes: LifeNode[],
  edges: Edge[],
  timing: Record<string, NodeTiming>
): Segment[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, Edge[]>()
  for (const n of nodes) incoming.set(n.id, [])
  for (const e of edges) incoming.get(e.to)?.push(e)

  const segmentStartCache = new Map<string, string>()
  function segmentStartOf(nodeId: string): string {
    const cached = segmentStartCache.get(nodeId)
    if (cached) return cached
    const node = byId.get(nodeId)!
    if (node.kind === 'start' || node.kind === 'merge' || node.kind === 'if') {
      segmentStartCache.set(nodeId, nodeId)
      return nodeId
    }
    const source = incoming.get(nodeId)?.[0]?.from
    const result = source ? segmentStartOf(source) : nodeId
    segmentStartCache.set(nodeId, result)
    return result
  }

  const nodeIdsByStart = new Map<string, string[]>()
  const syncEndByStart = new Map<string, string>()
  for (const n of nodes) {
    if (n.kind === 'start' || n.kind === 'merge') continue
    const start = segmentStartOf(n.id)
    if (n.kind === 'aksi') {
      if (!nodeIdsByStart.has(start)) nodeIdsByStart.set(start, [])
      nodeIdsByStart.get(start)!.push(n.id)
    }
    for (const e of edges) {
      if (e.from !== n.id) continue
      const target = byId.get(e.to)!
      if (target.kind === 'merge' || target.kind === 'if' || target.kind === 'end') {
        syncEndByStart.set(start, target.id)
      }
    }
  }
  // Segmen yang langsung dari start ke merge/end tanpa node aksi di antaranya.
  for (const n of nodes) {
    if (n.kind !== 'start' && n.kind !== 'merge') continue
    for (const e of edges) {
      if (e.from !== n.id) continue
      const target = byId.get(e.to)!
      if (target.kind === 'merge' || target.kind === 'if' || target.kind === 'end') {
        syncEndByStart.set(n.id, target.id)
      }
    }
  }

  const segments: Segment[] = []
  for (const [startId, endId] of syncEndByStart) {
    segments.push({
      id: `seg:${startId}`,
      syncStartId: startId,
      syncEndId: endId,
      umurMulai: timing[startId].umurSelesai,
      umurSelesai: timing[endId].umurMulai,
      nodeIds: nodeIdsByStart.get(startId) ?? [],
    })
  }
  segments.sort((a, b) => a.umurMulai - b.umurMulai)
  return segments
}

/**
 * Node aksi jalur ini raw ke node id di ujung rantai `tunggu` yang nempel
 * langsung setelahnya (aksi durasinya selalu 0, jadi durasi cabang yang keliatan
 * di gapTahun harus ngikutin node tunggu-nya, bukan cuma aksi-nya doang).
 * Berhenti begitu ketemu percabangan lain (>1 kabel keluar) atau node bukan tunggu.
 */
function chainEndId(nodeId: string, byId: Map<string, LifeNode>, outgoing: Map<string, Edge[]>): string {
  let current = nodeId
  while (true) {
    const outs = outgoing.get(current) ?? []
    if (outs.length !== 1) return current
    const next = byId.get(outs[0].to)
    if (!next || next.kind !== 'tunggu') return current
    current = next.id
  }
}

/** Kelompokin node aksi di satu segmen jadi payload `cabang` buat kontrak LLM (CLAUDE.md §7). */
export function segmentCabang(
  segment: Segment,
  nodes: LifeNode[],
  edges: Edge[],
  timing: Record<string, NodeTiming>
): Cabang[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = new Map<string, Edge[]>()
  for (const e of edges) {
    if (!outgoing.has(e.from)) outgoing.set(e.from, [])
    outgoing.get(e.from)!.push(e)
  }
  const byLane = new Map<NonNullable<LifeNode['lane']>, LifeNode[]>()
  for (const id of segment.nodeIds) {
    const n = byId.get(id)!
    if (!n.lane) continue
    if (!byLane.has(n.lane)) byLane.set(n.lane, [])
    byLane.get(n.lane)!.push(n)
  }

  const cabang: Cabang[] = []
  for (const [lane, laneNodes] of byLane) {
    laneNodes.sort((a, b) => timing[a.id].umurMulai - timing[b.id].umurMulai)
    const umurSelesaiTerakhir = Math.max(
      ...laneNodes.map((n) => timing[chainEndId(n.id, byId, outgoing)].umurSelesai)
    )
    cabang.push({
      lane,
      gapTahun: segment.umurSelesai - umurSelesaiTerakhir,
      nodes: laneNodes.map((n) => ({
        id: n.id,
        label: n.label ?? '',
        durasi: n.durasi ?? 0,
        intensity: n.intensity ?? 1,
        note: n.note,
      })),
    })
  }
  return cabang
}

const LAYOUT_LANE_ORDER: Lane[] = ['karir', 'relasi', 'kesehatan', 'chaos']
const LAYOUT_PX_PER_YEAR = 70
const LAYOUT_ROW_HEIGHT = 150
const LAYOUT_MARGIN_X = 60
const LAYOUT_MARGIN_Y = 60
// Floor for the gap between a node and any direct predecessor — without this,
// a Merge feeding straight into End (zero years apart) lands on the exact
// same X as its predecessor and the cards stack on top of each other.
const LAYOUT_MIN_GAP_X = 260

/**
 * Swimlane layout: X follows age (reuses computeGraph's timing) but never
 * closer to a direct predecessor than LAYOUT_MIN_GAP_X, so zero-duration
 * hops (Merge straight into End, etc.) still get visibly separated. Y bands
 * by lane; Start/Merge/End sit centered across the lane bands since they're
 * not lane-specific. Throws GraphCycleError on an invalid graph — caller
 * should only offer this once the graph passes validateGraph.
 */
export function autoLayout(graph: Graph, umurAwal: number): Record<string, { x: number; y: number }> {
  const { timing, order } = computeGraph(graph, umurAwal)
  const laneBandsHeight = LAYOUT_LANE_ORDER.length * LAYOUT_ROW_HEIGHT
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, Edge[]>()
  for (const n of graph.nodes) incoming.set(n.id, [])
  for (const e of graph.edges) incoming.get(e.to)?.push(e)

  const x: Record<string, number> = {}
  for (const id of order) {
    const ageX = LAYOUT_MARGIN_X + (timing[id].umurMulai - umurAwal) * LAYOUT_PX_PER_YEAR
    const preds = incoming.get(id) ?? []
    const predecessorFloor = preds.length > 0 ? Math.max(...preds.map((e) => x[e.from] + LAYOUT_MIN_GAP_X)) : -Infinity
    x[id] = Math.max(ageX, predecessorFloor)
  }

  const positions: Record<string, { x: number; y: number }> = {}
  for (const n of graph.nodes) {
    const lane = byId.get(n.id)?.lane
    const y =
      n.kind === 'aksi' && lane
        ? LAYOUT_MARGIN_Y + LAYOUT_LANE_ORDER.indexOf(lane) * LAYOUT_ROW_HEIGHT
        : LAYOUT_MARGIN_Y + laneBandsHeight / 2 - LAYOUT_ROW_HEIGHT / 2
    positions[n.id] = { x: x[n.id], y }
  }
  return positions
}
