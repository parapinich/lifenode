import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Edge, KondisiAwal, Lane, LifeNode } from './schema'

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

interface GraphStore {
  nodes: LifeNode[]
  edges: Edge[]
  kondisiAwal: KondisiAwal
  addAksiNode: (lane: Lane, label: string, x: number, y: number) => void
  updateNode: (id: string, patch: Partial<LifeNode>) => void
  removeNode: (id: string) => void
  addMergeNode: (x: number, y: number) => void
  moveNode: (id: string, x: number, y: number) => void
  addEdge: (from: string, to: string) => void
  removeEdge: (id: string) => void
  setKondisiAwal: (patch: Partial<KondisiAwal>) => void
}

const startNode: LifeNode = { id: 'start', kind: 'start', x: 40, y: 200 }
const endNode: LifeNode = { id: 'end', kind: 'end', x: 720, y: 200 }

export const useGraphStore = create<GraphStore>()(
  persist(
    (set) => ({
      nodes: [startNode, endNode],
      edges: [],
      kondisiAwal: { umur: 18, uang: 0, latarBelakang: '' },

      addAksiNode: (lane, label, x, y) =>
        set((s) => ({
          nodes: [
            ...s.nodes,
            { id: newId('aksi'), kind: 'aksi', x, y, lane, label, durasi: 1, intensity: 1 } satisfies LifeNode,
          ],
        })),

      addMergeNode: (x, y) =>
        set((s) => ({ nodes: [...s.nodes, { id: newId('merge'), kind: 'merge', x, y } satisfies LifeNode] })),

      updateNode: (id, patch) =>
        set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),

      moveNode: (id, x, y) =>
        set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) })),

      removeNode: (id) =>
        set((s) => ({
          nodes: s.nodes.filter((n) => n.id !== id),
          edges: s.edges.filter((e) => e.from !== id && e.to !== id),
        })),

      addEdge: (from, to) =>
        set((s) => ({ edges: [...s.edges, { id: newId('edge'), from, to }] })),

      removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

      setKondisiAwal: (patch) => set((s) => ({ kondisiAwal: { ...s.kondisiAwal, ...patch } })),
    }),
    {
      name: 'lifeflow-graph',
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges, kondisiAwal: s.kondisiAwal }),
    }
  )
)
