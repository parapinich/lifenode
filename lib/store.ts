import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { autoLayout, validateGraph } from './graph'
import { nextExample } from './examples'
import { useLocaleStore, translate } from './locale'
import { isNodeLocked, useRunStore } from './runStore'
import type { Edge, KondisiAwal, Lane, LifeNode } from './schema'

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`
interface GraphSnapshot { nodes: LifeNode[]; edges: Edge[]; kondisiAwal: KondisiAwal }
interface GraphStore extends GraphSnapshot {
  past: GraphSnapshot[]; future: GraphSnapshot[]; layoutVersion: number; exampleIndex: number
  addAksiNode: (lane: Lane, label: string, x: number, y: number) => void
  addTungguNode: (x: number, y: number) => void
  addIfNode: (x: number, y: number) => void
  addEventNode: (x: number, y: number) => void
  insertNode: (edgeId: string, kind: 'aksi' | 'tunggu' | 'if' | 'event', label?: string, lane?: Lane) => boolean
  addDecision: (label: string, lane: Lane, anchor?: string, mode?: 'after' | 'parallel') => void
  nextChapter: (label: string, lane: Lane) => void
  updateNode: (id: string, patch: Partial<LifeNode>) => void
  removeNode: (id: string) => void
  removeElements: (nodeIds: string[], edgeIds?: string[]) => void
  moveNode: (id: string, x: number, y: number) => void
  beginNodeDrag: () => void
  addEdge: (from: string, to: string) => void
  updateEdge: (id: string, patch: Partial<Edge>) => void
  removeEdge: (id: string) => void
  setKondisiAwal: (patch: Partial<KondisiAwal>) => void
  loadTemplate: () => void
  applyAutoLayout: () => void
  undo: () => void
  redo: () => void
}
const endpoints: LifeNode[] = [{ id: 'start', kind: 'start', x: 40, y: 200 }, { id: 'end', kind: 'end', x: 720, y: 200 }]
const busy = () => useRunStore.getState().running || useRunStore.getState().summaryLoading
export const edgeLocked = (e: Edge) => isNodeLocked(e.to) || !!useRunStore.getState().selectedBranches[e.from] || (isNodeLocked(e.from) && e.from !== useRunStore.getState().nextSyncId)

export const useGraphStore = create<GraphStore>()(persist((set, get) => {
  function snapshot() {
    if (useRunStore.getState().lifeState) return
    const { nodes, edges, kondisiAwal, past } = get()
    set({ past: [...past, { nodes, edges, kondisiAwal }].slice(-50), future: [] })
  }
  function add(node: LifeNode) {
    if (busy() || useRunStore.getState().chapterComplete) return
    snapshot()
    set((s) => ({ nodes: [...s.nodes, node] }))
  }
  return {
    nodes: endpoints, edges: [], kondisiAwal: { umur: 18, uang: 0, latarBelakang: '' }, past: [], future: [], layoutVersion: 0, exampleIndex: -1,
    addAksiNode: (lane, label, x, y) => add({ id: newId('aksi'), kind: 'aksi', x, y, lane, label, intensity: 1, durasi: 1 }),
    addTungguNode: (x, y) => add({ id: newId('tunggu'), kind: 'tunggu', x, y, durasi: 1 }),
    addIfNode: (x, y) => add({ id: newId('if'), kind: 'if', x, y }),
    addEventNode: (x, y) => add({ id: newId('event'), kind: 'event', x, y }),
    insertNode: (edgeId, kind, label = '', lane = 'chaos') => {
      const { nodes, edges, kondisiAwal } = get()
      const edge = edges.find((e) => e.id === edgeId)
      if (busy() || useRunStore.getState().chapterComplete || !edge || edgeLocked(edge) || (kind === 'aksi' && !label.trim())) return false
      const from = nodes.find((n) => n.id === edge.from)!
      const to = nodes.find((n) => n.id === edge.to)!
      const id = newId(kind)
      const language = useLocaleStore.getState().language
      const node: LifeNode = { id, kind, x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, ...(kind === 'aksi' ? { label: label.trim().slice(0, 60), lane, intensity: 1, durasi: 1 } : kind === 'tunggu' ? { durasi: 1 } : {}) }
      const nextNodes = [...nodes, node]
      const nextEdges = edges.map((e) => e.id === edgeId ? { ...e, to: id } : e)
      if (kind === 'if') {
        for (const [index, name] of (language === 'id' ? ['Ambil kesempatan', 'Lanjutkan rencana'] : ['Take the opportunity', 'Keep the plan']).entries()) {
          const branch = newId('aksi')
          nextNodes.push({ id: branch, kind: 'aksi', lane: 'chaos', label: name, durasi: 1, intensity: 1, x: node.x + 320, y: node.y + index * 340 })
          nextEdges.push({ id: newId('edge'), from: id, to: branch, label: language === 'id' ? (index ? 'Jika tidak memungkinkan' : 'Jika situasi mendukung') : (index ? 'Otherwise' : 'If circumstances allow') }, { id: newId('edge'), from: branch, to: edge.to })
        }
      } else nextEdges.push({ id: newId('edge'), from: id, to: edge.to })
      if (validateGraph({ nodes: nextNodes, edges: nextEdges }).length) return false
      snapshot()
      const positions = autoLayout({ nodes: nextNodes, edges: nextEdges }, kondisiAwal.umur)
      set((s) => ({ nodes: nextNodes.map((n) => ({ ...n, ...positions[n.id] })), edges: nextEdges, layoutVersion: s.layoutVersion + 1 }))
      return true
    },
    updateNode: (id, patch) => {
      if (busy() || isNodeLocked(id)) return
      set((s) => ({ nodes: s.nodes.map((n) => n.id === id ? { ...n, ...patch } : n) }))
    },
    moveNode: (id, x, y) => set((s) => ({ nodes: s.nodes.map((n) => n.id === id ? { ...n, x, y } : n) })),
    beginNodeDrag: snapshot,
    removeNode: (id) => get().removeElements([id]),
    removeElements: (nodeIds, edgeIds = []) => {
      if (busy()) return
      const { nodes, edges } = get()
      const requested = new Set(nodeIds)
      const removed = new Set(nodes.filter((n) => requested.has(n.id) && n.kind !== 'start' && n.kind !== 'end' && !isNodeLocked(n.id) && !edges.some((e) => (e.from === n.id || e.to === n.id) && edgeLocked(e))).map((n) => n.id))
      const selectedEdges = new Set(edgeIds)
      const nextEdges = edges.filter((e) => !removed.has(e.from) && !removed.has(e.to) && !(selectedEdges.has(e.id) && !edgeLocked(e)))
      if (!removed.size && nextEdges.length === edges.length) return
      snapshot()
      set({ nodes: nodes.filter((n) => !removed.has(n.id)), edges: nextEdges })
    },
    addEdge: (from, to) => {
      if (busy() || edgeLocked({ id: '', from, to }) || get().edges.some((e) => e.from === from && e.to === to)) return
      snapshot()
      set((s) => ({ edges: [...s.edges, { id: newId('edge'), from, to }] }))
    },
    updateEdge: (id, patch) => {
      const edge = get().edges.find((e) => e.id === id)
      if (busy() || !edge || isNodeLocked(edge.from)) return
      set((s) => ({ edges: s.edges.map((e) => e.id === id ? { ...e, ...patch } : e) }))
    },
    removeEdge: (id) => {
      get().removeElements([], [id])
    },
    setKondisiAwal: (patch) => {
      if (busy() || useRunStore.getState().lifeState) return
      set((s) => ({ kondisiAwal: { ...s.kondisiAwal, ...patch } }))
    },
    loadTemplate: () => {
      if (busy()) return
      const run = useRunStore.getState()
      const language = useLocaleStore.getState().language
      if (run.lifeState && typeof window !== 'undefined' && !window.confirm(translate(language, 'Open another life? The current progress will be cleared.'))) return
      snapshot()
      run.reset()
      const example = nextExample(get().exampleIndex, language)
      const positions = autoLayout(example.graph, example.kondisiAwal.umur)
      set((s) => ({ nodes: example.graph.nodes.map((n) => ({ ...n, ...positions[n.id] })), edges: example.graph.edges, kondisiAwal: example.kondisiAwal, exampleIndex: example.index, past: run.lifeState ? [] : s.past, future: [], layoutVersion: s.layoutVersion + 1 }))
    },
    addDecision: (label, lane, anchor, mode = 'after') => {
      const run = useRunStore.getState()
      if (busy() || run.chapterComplete || !label.trim()) return
      const { nodes, edges } = get()
      const source = nodes.find((n) => n.id === (anchor ?? run.nextSyncId)) ?? nodes.find((n) => n.kind === 'start')
      const end = nodes.find((n) => n.kind === 'end')
      if (!source || !end || ['end', 'if', 'tunggu', 'event'].includes(source.kind) || (isNodeLocked(source.id) && source.id !== run.nextSyncId)) return
      snapshot()
      const id = newId('aksi')
      const outgoing = edges.filter((e) => e.from === source.id)
      let nextEdges: Edge[]
      if (mode === 'parallel' && source.kind === 'aksi') {
        const incoming = edges.filter((e) => e.to === source.id)
        nextEdges = [...edges, ...incoming.map((e) => ({ ...e, id: newId('edge'), to: id })), ...outgoing.map((e) => ({ id: newId('edge'), from: id, to: e.to }))]
      } else {
        nextEdges = [...edges.filter((e) => e.from !== source.id), { id: newId('edge'), from: source.id, to: id }, ...(outgoing.length ? outgoing.map((e) => ({ ...e, id: newId('edge'), from: id })) : [{ id: newId('edge'), from: id, to: end.id }])]
      }
      set({ nodes: [...nodes, { id, kind: 'aksi', lane, label: label.trim().slice(0, 60), durasi: 1, intensity: 1, x: source.x + (mode === 'parallel' ? 0 : 320), y: source.y + (mode === 'parallel' ? 340 : 0) }], edges: nextEdges })
    },
    nextChapter: (label, lane) => {
      const run = useRunStore.getState()
      if (busy() || !run.chapterComplete || !run.lifeState?.hidup || !label.trim()) return
      const id = newId('aksi')
      const nodes: LifeNode[] = [...endpoints.map((n) => ({ ...n })), { id, kind: 'aksi', lane, label: label.trim().slice(0, 60), durasi: 1, intensity: 1, x: 320, y: 200 }]
      const edges = [{ id: newId('edge'), from: 'start', to: id }, { id: newId('edge'), from: id, to: 'end' }]
      set((s) => ({ nodes, edges, kondisiAwal: { ...s.kondisiAwal, umur: run.lifeState!.umur, uang: run.lifeState!.uang }, past: [], future: [], layoutVersion: s.layoutVersion + 1 }))
      useRunStore.setState({ nextSyncId: 'start', chapterComplete: false, lockedNodeIds: ['start'], selectedBranches: {}, branchNarratives: {}, nodeStatus: {}, error: null, summary: null, summaryError: null })
    },
    applyAutoLayout: () => {
      if (busy()) return
      const { nodes, edges, kondisiAwal } = get()
      try {
        const positions = autoLayout({ nodes, edges }, kondisiAwal.umur)
        snapshot()
        set((s) => ({ nodes: nodes.map((n) => ({ ...n, ...positions[n.id] })), layoutVersion: s.layoutVersion + 1 }))
      } catch { return }
    },
    undo: () => {
      if (busy() || useRunStore.getState().lifeState) return
      const { past, nodes, edges, kondisiAwal, future } = get()
      if (past.length) set({ ...past[past.length - 1], past: past.slice(0, -1), future: [{ nodes, edges, kondisiAwal }, ...future] })
    },
    redo: () => {
      if (busy() || useRunStore.getState().lifeState) return
      const { future, nodes, edges, kondisiAwal, past } = get()
      if (future.length) set({ ...future[0], future: future.slice(1), past: [...past, { nodes, edges, kondisiAwal }] })
    },
  }
}, { name: 'lifenode-graph', partialize: (s) => ({ nodes: s.nodes, edges: s.edges, kondisiAwal: s.kondisiAwal, exampleIndex: s.exampleIndex }) }))
