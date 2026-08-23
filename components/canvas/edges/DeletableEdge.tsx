import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react'
import { X } from 'lucide-react'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'

export function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }: EdgeProps<Edge>) {
  const removeEdge = useGraphStore((s) => s.removeEdge)
  const running = useRunStore((s) => s.running)
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: 'var(--ink-soft)', strokeWidth: selected ? 2.5 : 1.5 }} />
      {selected && !running && (
        <EdgeLabelRenderer>
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeEdge(id)
            }}
            className="nodrag nopan absolute flex h-5 w-5 items-center justify-center rounded-full border border-stamp-red bg-paper-raised text-stamp-red shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
            title="Delete connection"
          >
            <X size={12} />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
