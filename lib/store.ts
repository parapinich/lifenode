import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { autoLayout } from './graph'
import type { Edge, KondisiAwal, Lane, LifeNode } from './schema'

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

interface GraphSnapshot {
  nodes: LifeNode[]
  edges: Edge[]
}

const MAX_HISTORY = 50

interface GraphStore {
  nodes: LifeNode[]
  edges: Edge[]
  kondisiAwal: KondisiAwal
  past: GraphSnapshot[]
  future: GraphSnapshot[]
  layoutVersion: number
  addAksiNode: (lane: Lane, label: string, x: number, y: number) => void
  updateNode: (id: string, patch: Partial<LifeNode>) => void
  removeNode: (id: string) => void
  addTungguNode: (x: number, y: number) => void
  addIfNode: (x: number, y: number) => void
  addMergeNode: (x: number, y: number) => void
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

const startNode: LifeNode = { id: 'start', kind: 'start', x: 40, y: 200 }
const endNode: LifeNode = { id: 'end', kind: 'end', x: 720, y: 200 }

const TEMPLATE_KONDISI: KondisiAwal = { umur: 20, uang: 2_000_000, latarBelakang: 'fresh out of college' }
const TEMPLATE_NODES: LifeNode[] = [
  { id: 'start', kind: 'start', x: 0, y: 0 },
  { id: 't-karir', kind: 'aksi', x: 0, y: 0, lane: 'karir', label: 'Take an office job', intensity: 2 },
  { id: 't-karir-wait', kind: 'tunggu', x: 0, y: 0, durasi: 5 },
  { id: 't-relasi', kind: 'aksi', x: 0, y: 0, lane: 'relasi', label: 'Start dating', intensity: 2 },
  { id: 't-relasi-wait', kind: 'tunggu', x: 0, y: 0, durasi: 2 },
  { id: 't-chaos', kind: 'aksi', x: 0, y: 0, lane: 'chaos', label: 'Join an MLM', intensity: 3 },
  { id: 't-chaos-wait', kind: 'tunggu', x: 0, y: 0, durasi: 1 },
  { id: 't-merge', kind: 'merge', x: 0, y: 0 },
  { id: 'end', kind: 'end', x: 0, y: 0 },
]
const TEMPLATE_EDGES: Edge[] = [
  { id: 'te1', from: 'start', to: 't-karir' },
  { id: 'te1w', from: 't-karir', to: 't-karir-wait' },
  { id: 'te2', from: 'start', to: 't-relasi' },
  { id: 'te2w', from: 't-relasi', to: 't-relasi-wait' },
  { id: 'te3', from: 'start', to: 't-chaos' },
  { id: 'te3w', from: 't-chaos', to: 't-chaos-wait' },
  { id: 'te4', from: 't-karir-wait', to: 't-merge' },
  { id: 'te5', from: 't-relasi-wait', to: 't-merge' },
  { id: 'te6', from: 't-chaos-wait', to: 't-merge' },
  { id: 'te7', from: 't-merge', to: 'end' },
]

function positioned(nodes: LifeNode[], positions: Record<string, { x: number; y: number }>): LifeNode[] {
  return nodes.map((n) => (positions[n.id] ? { ...n, ...positions[n.id] } : n))
}

export const useGraphStore = create<GraphStore>()(
  persist(
    (set, get) => {
      // ponytail: snapshots only cover nodes/edges, not text-field edits (label,
      // lane, durasi, intensity, kondisiAwal) — those fire on every keystroke and
      // would flood the undo stack. Add per-field debounced snapshots if that's
      // ever requested.
      function snapshot() {
        const { nodes, edges, past } = get()
        const next = [...past, { nodes, edges }].slice(-MAX_HISTORY)
        set({ past: next, future: [] })
      }

      return {
        nodes: [startNode, endNode],
        edges: [],
        kondisiAwal: { umur: 18, uang: 0, latarBelakang: '' },
        past: [],
        future: [],
        layoutVersion: 0,

        addAksiNode: (lane, label, x, y) => {
          snapshot()
          set((s) => ({
            nodes: [
              ...s.nodes,
              { id: newId('aksi'), kind: 'aksi', x, y, lane, label, intensity: 1 } satisfies LifeNode,
            ],
          }))
        },

        addTungguNode: (x, y) => {
          snapshot()
          set((s) => ({
            nodes: [...s.nodes, { id: newId('tunggu'), kind: 'tunggu', x, y, durasi: 1 } satisfies LifeNode],
          }))
        },

        addIfNode: (x, y) => {
          snapshot()
          set((s) => ({ nodes: [...s.nodes, { id: newId('if'), kind: 'if', x, y } satisfies LifeNode] }))
        },

        addMergeNode: (x, y) => {
          snapshot()
          set((s) => ({ nodes: [...s.nodes, { id: newId('merge'), kind: 'merge', x, y } satisfies LifeNode] }))
        },

        updateNode: (id, patch) =>
          set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),

        moveNode: (id, x, y) =>
          set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) })),

        beginNodeDrag: () => snapshot(),

        removeNode: (id) => {
          snapshot()
          set((s) => ({
            nodes: s.nodes.filter((n) => n.id !== id),
            edges: s.edges.filter((e) => e.from !== id && e.to !== id),
          }))
        },

        addEdge: (from, to) => {
          snapshot()
          set((s) => ({ edges: [...s.edges, { id: newId('edge'), from, to }] }))
        },

        updateEdge: (id, patch) =>
          set((s) => ({ edges: s.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

        removeEdge: (id) => {
          snapshot()
          set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }))
        },

        setKondisiAwal: (patch) => set((s) => ({ kondisiAwal: { ...s.kondisiAwal, ...patch } })),

        loadTemplate: () => {
          snapshot()
          const positions = autoLayout({ nodes: TEMPLATE_NODES, edges: TEMPLATE_EDGES }, TEMPLATE_KONDISI.umur)
          set((s) => ({
            nodes: positioned(TEMPLATE_NODES, positions),
            edges: TEMPLATE_EDGES.map((e) => ({ ...e })),
            kondisiAwal: { ...TEMPLATE_KONDISI },
            layoutVersion: s.layoutVersion + 1,
          }))
        },

        applyAutoLayout: () => {
          const { nodes, edges, kondisiAwal } = get()
          let positions: Record<string, { x: number; y: number }>
          try {
            positions = autoLayout({ nodes, edges }, kondisiAwal.umur)
          } catch {
            return // graph has a cycle — leave positions alone
          }
          snapshot()
          set((s) => ({ nodes: positioned(nodes, positions), layoutVersion: s.layoutVersion + 1 }))
        },

        undo: () => {
          const { past, nodes, edges, future } = get()
          if (past.length === 0) return
          const previous = past[past.length - 1]
          set({
            nodes: previous.nodes,
            edges: previous.edges,
            past: past.slice(0, -1),
            future: [{ nodes, edges }, ...future],
          })
        },

        redo: () => {
          const { future, nodes, edges, past } = get()
          if (future.length === 0) return
          const next = future[0]
          set({
            nodes: next.nodes,
            edges: next.edges,
            past: [...past, { nodes, edges }],
            future: future.slice(1),
          })
        },
      }
    },
    {
      name: 'lifenode-graph',
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges, kondisiAwal: s.kondisiAwal }),
    }
  )
)
