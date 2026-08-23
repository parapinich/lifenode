import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react'
import { X } from 'lucide-react'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'

interface DeletableEdgeData {
  completed?: boolean
  skipped?: boolean
  isIfEdge?: boolean
  conditionLabel?: string
}

export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  animated,
  data,
}: EdgeProps<Edge>) {
  const removeEdge = useGraphStore((s) => s.removeEdge)
  const updateEdge = useGraphStore((s) => s.updateEdge)
  const running = useRunStore((s) => s.running)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const { completed, skipped, isIfEdge, conditionLabel } = (data as DeletableEdgeData | undefined) ?? {}
  const stroke = skipped ? 'var(--ink-soft)' : animated ? 'var(--stamp-red)' : completed ? 'var(--ink)' : 'var(--ink-soft)'

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth: selected || animated ? 2.5 : 1.5,
          strokeDasharray: skipped ? '4 3' : undefined,
          opacity: skipped ? 0.4 : 1,
        }}
      />
      {isIfEdge && !running && (
        <EdgeLabelRenderer>
          <input
            className="nodrag nopan absolute rounded-md border border-line bg-paper-raised px-1.5 py-0.5 text-center font-sans text-[10px] text-ink outline-none placeholder:text-ink-soft"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
            value={conditionLabel ?? ''}
            placeholder="condition..."
            maxLength={60}
            onChange={(e) => updateEdge(id, { label: e.target.value })}
          />
        </EdgeLabelRenderer>
      )}
      {selected && !running && (
        <EdgeLabelRenderer>
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeEdge(id)
            }}
            className="nodrag nopan absolute flex h-5 w-5 items-center justify-center rounded-full border border-stamp-red bg-paper-raised text-stamp-red shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - (isIfEdge ? 22 : 0)}px)`,
              pointerEvents: 'all',
            }}
            title="Delete connection"
          >
            <X size={12} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
