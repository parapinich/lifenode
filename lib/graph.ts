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

export function validateGraph(graph: Graph): ValidationIssue[] {
  const { nodes, edges } = graph
  const issues: ValidationIssue[] = []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, Edge[]>()
  const outgoingCount = new Map<string, number>()
  for (const n of nodes) {
    incoming.set(n.id, [])
    outgoingCount.set(n.id, 0)
  }
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue
    incoming.get(e.to)?.push(e)
    outgoingCount.set(e.from, (outgoingCount.get(e.from) ?? 0) + 1)
  }

  const starts = nodes.filter((n) => n.kind === 'start')
  const ends = nodes.filter((n) => n.kind === 'end')
  const merges = nodes.filter((n) => n.kind === 'merge')
  if (starts.length !== 1) issues.push({ nodeId: '', pesan: `Graph needs exactly one start node, found ${starts.length}` })
  if (ends.length !== 1) issues.push({ nodeId: '', pesan: `Graph needs exactly one end node, found ${ends.length}` })
  if (merges.length > 5) issues.push({ nodeId: '', pesan: `Maximum 5 Merge nodes per graph, found ${merges.length}` })

  for (const n of nodes) {
    const label = n.label ?? n.id
    if (n.kind === 'merge' && (incoming.get(n.id)?.length ?? 0) < 2) {
      issues.push({ nodeId: n.id, pesan: `Node '${label}' needs at least 2 incoming connections to be a Merge` })
    }
    if (n.kind === 'aksi') {
      if (!n.durasi) issues.push({ nodeId: n.id, pesan: `Node '${label}' is missing a duration` })
      if (!n.label) issues.push({ nodeId: n.id, pesan: `Step node '${n.id}' is missing a label` })
    }
  }

  let order: string[] | null = null
  try {
    order = topologicalSort(nodes, edges)
  } catch {
    issues.push({ nodeId: '', pesan: 'Graph contains a cycle' })
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
      // aksi / end: tepat satu kabel masuk (graf sudah divalidasi)
      const umurMulai = timing[inEdges[0].from].umurSelesai
      const durasi = node.kind === 'aksi' ? (node.durasi ?? 0) : 0
      timing[id] = { umurMulai, umurSelesai: umurMulai + durasi }
    }
  }

  const segments = computeSegments(nodes, edges, timing)
  return { order, timing, gaps, segments }
}

/**
 * Kelompokin node aksi ke segmen berdasarkan sync point (start/merge) terdekat
 * di belakangnya. ponytail: kalau satu node aksi bercabang ke dua merge yang
 * beda sebelum ada merge lain di antaranya, segmen ditentukan dari sync point
 * paling awal yang ditemukan pas nodes-nya diproses — kasus itu di luar
 * cakupan MVP (lihat CLAUDE.md §2, cabang selalu ketemu lagi di satu Merge).
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
    if (node.kind === 'start' || node.kind === 'merge') {
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
      if (target.kind === 'merge' || target.kind === 'end') {
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
      if (target.kind === 'merge' || target.kind === 'end') {
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

/** Kelompokin node aksi di satu segmen jadi payload `cabang` buat kontrak LLM (CLAUDE.md §7). */
export function segmentCabang(
  segment: Segment,
  nodes: LifeNode[],
  timing: Record<string, NodeTiming>
): Cabang[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
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
    const umurSelesaiTerakhir = Math.max(...laneNodes.map((n) => timing[n.id].umurSelesai))
    cabang.push({
      lane,
      gapTahun: segment.umurSelesai - umurSelesaiTerakhir,
      nodes: laneNodes.map((n) => ({
        id: n.id,
        label: n.label ?? '',
        durasi: n.durasi ?? 0,
        intensity: n.intensity ?? 1,
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
