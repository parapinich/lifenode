import { create } from 'zustand'
import type { LifeState, RingkasanResponse, StatusNode } from './schema'

export type NodeRunStatus = 'idle' | 'loading' | StatusNode | 'skipped'

const TERMINAL_STATUSES = new Set<NodeRunStatus>(['sukses', 'separuh', 'gagal'])
export function isTerminalStatus(status: NodeRunStatus | undefined): boolean {
  return status !== undefined && TERMINAL_STATUSES.has(status)
}

export interface SegmentResultView {
  segmentId: string
  narasiSegmen: string
  narasiGap: { lane: string; teks: string }[]
  perNode: { nodeId: string; status: StatusNode; teks: string; alasan?: string }[]
}

interface RunStore {
  running: boolean
  nodeStatus: Record<string, NodeRunStatus>
  initialState: LifeState | null
  lifeState: LifeState | null
  results: SegmentResultView[]
  error: string | null
  summary: RingkasanResponse | null
  summaryLoading: boolean
  summaryError: string | null
  startRun: (initial: LifeState) => void
  setNodeStatus: (id: string, status: NodeRunStatus) => void
  pushResult: (result: SegmentResultView, newState: LifeState) => void
  finishRun: () => void
  fail: (message: string) => void
  requestSummary: () => void
  setSummary: (summary: RingkasanResponse) => void
  failSummary: (message: string) => void
  closeSummary: () => void
}

export const useRunStore = create<RunStore>((set) => ({
  running: false,
  nodeStatus: {},
  initialState: null,
  lifeState: null,
  results: [],
  error: null,
  summary: null,
  summaryLoading: false,
  summaryError: null,

  startRun: (initial) =>
    set({ running: true, nodeStatus: {}, results: [], error: null, initialState: initial, lifeState: initial, summary: null, summaryError: null }),

  setNodeStatus: (id, status) => set((s) => ({ nodeStatus: { ...s.nodeStatus, [id]: status } })),

  pushResult: (result, newState) =>
    set((s) => ({ results: [...s.results, result], lifeState: newState })),

  finishRun: () => set({ running: false }),

  fail: (message) => set({ running: false, error: message }),

  requestSummary: () => set({ summaryLoading: true, summaryError: null }),
  setSummary: (summary) => set({ summary, summaryLoading: false }),
  failSummary: (message) => set({ summaryLoading: false, summaryError: message }),
  closeSummary: () => set({ summary: null, summaryError: null }),
}))
