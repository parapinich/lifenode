import type { Cabang, Edge, Graph, LifeNode, ValidationIssue } from './schema'

export class GraphCycleError extends Error {
  constructor() {
    super('Graph contains a cycle')
  }
}

export function executionGraph(graph: Graph, choices: Record<string, string>): Graph {
  for (const [nodeId, edgeId] of Object.entries(choices)) {
    if (!graph.nodes.some((n) => n.id === nodeId && n.kind === 'if') || !graph.edges.some((e) => e.id === edgeId && e.from === nodeId)) throw new Error('Invalid branch choice')
  }
  const edges = graph.edges.filter((e) => !choices[e.from] || choices[e.from] === e.id || (!!e.label && graph.edges.find((chosen) => chosen.id === choices[e.from])?.label === e.label))
  const start = graph.nodes.find((n) => n.kind === 'start')
  if (!start) throw new Error('Missing start')
  const reachable = reachableForward(start.id, graph.nodes, edges)
  return { nodes: graph.nodes.filter((n) => reachable.has(n.id)), edges: edges.filter((e) => reachable.has(e.from) && reachable.has(e.to)) }
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
    const own = node.kind === 'if' || node.kind === 'event' ? 2 : node.kind === 'merge' ? 1 : 0
    const inEdges = incoming.get(id) ?? []
    const maxPred = inEdges.length > 0 ? Math.max(...inEdges.map((e) => pathCost[e.from] ?? 0)) : 0
    pathCost[id] = own + maxPred
  }

  const end = nodes.find((n) => n.kind === 'end')
  return (end ? pathCost[end.id] : 0) + 1
}

export function validateGraph(graph: Graph, language: 'en' | 'id' = 'en'): ValidationIssue[] {
  const say = (en: string, id: string) => language === 'id' ? id : en
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
  if (starts.length !== 1) issues.push({ nodeId: '', pesan: say(`Graph needs exactly one start node, found ${starts.length}`, `Rencana perlu satu awal hidup, ditemukan ${starts.length}`) })
  if (ends.length !== 1) issues.push({ nodeId: '', pesan: say(`Graph needs exactly one end node, found ${ends.length}`, `Rencana perlu satu akhir babak, ditemukan ${ends.length}`) })

  for (const n of nodes) {
    const label = n.label ?? n.id
    if (n.kind === 'merge' && (incoming.get(n.id)?.length ?? 0) < 1) {
      issues.push({ nodeId: n.id, pesan: say(`Checkpoint '${label}' needs an incoming connection`, `Titik temu '${label}' perlu hubungan masuk`) })
    }
    if (n.kind === 'aksi') {
      if (!n.label) issues.push({ nodeId: n.id, pesan: say(`Step node '${n.id}' is missing a label`, `Keputusan '${n.id}' belum diberi nama`) })
    }
    if ((n.kind === 'aksi' || n.kind === 'tunggu') && n.durasi !== undefined && (!Number.isFinite(n.durasi) || n.durasi < 0.5 || n.durasi % 0.5 !== 0)) {
      issues.push({ nodeId: n.id, pesan: say(`Node '${label}' needs at least 0.5 years, in half-year steps`, `Keputusan '${label}' perlu durasi minimal 0,5 tahun, kelipatan setengah tahun`) })
    }
    if (n.kind === 'tunggu') {
      if (!n.durasi) issues.push({ nodeId: n.id, pesan: say(`Wait node '${n.id}' is missing a duration`, `Waktu tunggu '${n.id}' belum memiliki durasi`) })
      if ((incoming.get(n.id)?.length ?? 0) < 1) {
        issues.push({ nodeId: n.id, pesan: say(`Wait node '${label}' needs an incoming connection`, `Waktu tunggu '${label}' perlu hubungan masuk`) })
      }
      if ((outgoingEdges.get(n.id)?.length ?? 0) < 1) {
        issues.push({ nodeId: n.id, pesan: say(`Wait node '${label}' needs an outgoing connection`, `Waktu tunggu '${label}' perlu hubungan keluar`) })
      }
    }
    if (n.kind === 'if') {
      const outs = outgoingEdges.get(n.id) ?? []
      if ((incoming.get(n.id)?.length ?? 0) < 1) {
        issues.push({ nodeId: n.id, pesan: say(`If node '${label}' needs an incoming connection`, `Percabangan '${label}' perlu hubungan masuk`) })
      }
      if (new Set(outs.map((e) => e.label)).size < 2) {
        issues.push({ nodeId: n.id, pesan: say(`If node '${label}' needs at least 2 outgoing branches`, `Percabangan '${label}' perlu setidaknya 2 pilihan`) })
      }
      if (outs.some((e) => !e.label)) {
        issues.push({ nodeId: n.id, pesan: say(`Every branch out of If node '${label}' needs a condition label`, `Setiap pilihan dari '${label}' perlu syarat`) })
      }
    }
    if (n.kind === 'event' && (!(incoming.get(n.id)?.length) || !outgoingEdges.get(n.id)?.length)) {
      issues.push({ nodeId: n.id, pesan: say('Random Event needs incoming and outgoing connections', 'Kejadian Acak perlu hubungan masuk dan keluar') })
    }
  }

  let order: string[] | null = null
  try {
    order = topologicalSort(nodes, edges)
  } catch {
    issues.push({ nodeId: '', pesan: say('Graph contains a cycle', 'Hubungan keputusan membentuk putaran') })
  }

  if (order && starts.length === 1 && ends.length === 1) {
    const worst = worstCaseCallCount(graph)
    if (worst > MAX_LLM_CALLS) {
      issues.push({
        nodeId: '',
        pesan: say(`Graph's worst-case path needs up to ${worst} LLM calls, but the limit is ${MAX_LLM_CALLS} per run`, `Rencana terlalu panjang: ${worst} bagian, batas ${MAX_LLM_CALLS} per rencana`),
      })
    }
    try {
      const { timing } = computeGraph(graph, 0)
      for (const n of nodes.filter((n) => ['start', 'merge', 'event'].includes(n.kind))) computeOneSegment(nodes, edges, timing, n.id)
      for (const n of nodes.filter((n) => n.kind === 'if')) {
        for (const edge of outgoingEdges.get(n.id) ?? []) {
          const branchEdges = edges.filter((e) => e.from !== n.id || e.label === edge.label)
          computeOneSegment(nodes, branchEdges, timing, n.id)
        }
      }
    } catch {
      issues.push({ nodeId: '', pesan: say('Parallel paths must rejoin before an If or Random Event', 'Jalur paralel perlu bergabung sebelum Jika atau Kejadian Acak') })
    }
  }

  if (order && starts.length === 1) {
    const startId = starts[0].id
    const reachableFromStart = reachableForward(startId, nodes, edges)
    for (const n of nodes) {
      if (n.id === startId) continue
      if (!reachableFromStart.has(n.id)) {
        issues.push({ nodeId: n.id, pesan: say(`Node '${n.label ?? n.id}' isn't connected to start`, `Keputusan '${n.label ?? n.id}' belum terhubung dengan awal hidup`) })
      }
    }
  }

  if (order && ends.length === 1) {
    const endId = ends[0].id
    const canReachEnd = reachableBackward(endId, nodes, edges)
    for (const n of nodes) {
      if (n.id === endId) continue
      if (!canReachEnd.has(n.id)) {
        issues.push({ nodeId: n.id, pesan: say(`Node '${n.label ?? n.id}' has no path to end`, `Keputusan '${n.label ?? n.id}' belum terhubung dengan akhir babak`) })
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
    } else if (node.kind === 'merge' || node.kind === 'end') {
      const umurMulai = Math.max(umurAwal, ...inEdges.map((e) => timing[e.from].umurSelesai))
      timing[id] = { umurMulai, umurSelesai: umurMulai }
      for (const e of inEdges) {
        gaps.push({ mergeId: id, fromNodeId: e.from, gapTahun: umurMulai - timing[e.from].umurSelesai })
      }
    } else {
      const umurMulai = Math.max(umurAwal, ...inEdges.map((e) => timing[e.from].umurSelesai))
      const durasi = node.kind === 'aksi' ? (node.durasi ?? 1) : node.kind === 'tunggu' ? (node.durasi ?? 0) : 0
      timing[id] = { umurMulai, umurSelesai: umurMulai + durasi }
      if (!Number.isFinite(timing[id].umurSelesai) || (durasi > 0 && timing[id].umurSelesai <= umurMulai)) throw new Error('Duration exceeds numeric precision')
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
    if (node.kind === 'merge' || node.kind === 'if' || node.kind === 'event' || node.kind === 'end') {
      if (syncEndId && syncEndId !== id) throw new Error('Parallel decisions must meet at the same checkpoint')
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
    if (node.kind === 'start' || node.kind === 'merge' || node.kind === 'if' || node.kind === 'event') {
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
      if (target.kind === 'merge' || target.kind === 'if' || target.kind === 'event' || target.kind === 'end') {
        syncEndByStart.set(start, target.id)
      }
    }
  }
  // Segmen yang langsung dari start ke merge/end tanpa node aksi di antaranya.
  for (const n of nodes) {
    if (n.kind !== 'start' && n.kind !== 'merge' && n.kind !== 'event') continue
    for (const e of edges) {
      if (e.from !== n.id) continue
      const target = byId.get(e.to)!
      if (target.kind === 'merge' || target.kind === 'if' || target.kind === 'event' || target.kind === 'end') {
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
      // ponytail: clamp ke 0 — kalau chainEndId nyasar ke sync point beda
      // dari segment.syncEndId (mis. cabang if yang nggak nyatu balik di
      // titik yang sama, di luar asumsi "cabang selalu ketemu di satu
      // merge/if", lihat computeSegments), umurSelesaiTerakhir bisa keitung
      // lebih besar dari segment.umurSelesai. Gap negatif nggak masuk akal
      // dan bikin SegmentRequestSchema (min 0) nolak mentah-mentah.
      gapTahun: Math.max(0, segment.umurSelesai - umurSelesaiTerakhir),
      nodes: laneNodes.map((n) => ({
        id: n.id,
        label: n.label ?? '',
        durasi: n.durasi ?? 1,
        intensity: n.intensity ?? 1,
        note: n.note,
        umurMulai: timing[n.id].umurMulai,
        umurSelesai: timing[n.id].umurSelesai,
        predecessors: edges.filter((e) => e.to === n.id).map((e) => e.from),
      })),
    })
  }
  return cabang
}

// Dependency columns keep long durations from stretching the canvas.
export function autoLayout(graph: Graph, umurAwal: number): Record<string, { x: number; y: number }> {
  void umurAwal
  const order = topologicalSort(graph.nodes, graph.edges)
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const depth: Record<string, number> = {}
  const columns = new Map<number, string[]>()
  for (const id of order) {
    const incoming = graph.edges.filter((e) => e.to === id)
    depth[id] = incoming.length ? Math.max(...incoming.map((e) => depth[e.from] + 1)) : 0
    const column = columns.get(depth[id]) ?? []
    column.push(id)
    columns.set(depth[id], column)
  }
  const positions: Record<string, { x: number; y: number }> = {}
  const height = (id: string) => byId.get(id)?.kind === 'aksi' ? 300 : byId.get(id)?.kind === 'if' ? 180 : 100
  for (const [level, ids] of columns) {
    const total = ids.reduce((sum, id) => sum + height(id) + 40, -40)
    let y = -total / 2
    for (const id of ids) {
      positions[id] = { x: 60 + level * 340, y }
      y += height(id) + 40
    }
  }
  const minY = Math.min(0, ...Object.values(positions).map((p) => p.y))
  for (const p of Object.values(positions)) p.y += 60 - minY
  return positions
}
