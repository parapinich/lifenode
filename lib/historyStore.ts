import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { KondisiAwal, LifeState, RingkasanResponse } from './schema'

export interface HistoryEntry {
  id: string
  timestamp: number
  kondisiAwal: KondisiAwal
  stateAkhir: LifeState
  summary: RingkasanResponse
}

const MAX_ENTRIES = 20

interface HistoryStore {
  entries: HistoryEntry[]
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void
  removeEntry: (id: string) => void
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((s) => ({
          entries: [{ ...entry, id: crypto.randomUUID(), timestamp: Date.now() }, ...s.entries].slice(0, MAX_ENTRIES),
        })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
    }),
    { name: 'lifenode-history' }
  )
)
