import type { Lane, LifeNode } from '@/lib/schema'
import type { NodeRunStatus } from '@/lib/runStore'

export type LifeFlowNodeData = LifeNode & {
  umurMulai?: number
  umurSelesai?: number
  issues: string[]
  runStatus?: NodeRunStatus
}

export const LANE_STYLE: Record<Lane, { border: string; text: string }> = {
  karir: { border: 'border-l-lane-karir', text: 'text-lane-karir' },
  relasi: { border: 'border-l-lane-relasi', text: 'text-lane-relasi' },
  kesehatan: { border: 'border-l-lane-kesehatan', text: 'text-lane-kesehatan' },
  chaos: { border: 'border-l-lane-chaos', text: 'text-lane-chaos' },
}

export const LANE_LABEL: Record<Lane, string> = {
  karir: 'Career',
  relasi: 'Relationships',
  kesehatan: 'Health',
  chaos: 'Chaos',
}
