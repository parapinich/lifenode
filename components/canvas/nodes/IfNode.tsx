import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Trash2, Split } from 'lucide-react'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'
import type { LifeFlowNodeData } from './shared'

export function IfNode({ id, data }: NodeProps<Node<LifeFlowNodeData>>) {
  const removeNode = useGraphStore((s) => s.removeNode)
  const edges = useGraphStore((s) => s.edges)
  const running = useRunStore((s) => s.running)
  const hasIssue = data.issues.length > 0
  const isLoading = data.runStatus === 'loading'
  const branches = edges.filter((e) => e.from === id)

  return (
    <div
      className={`group relative w-52 rounded-xl border border-line bg-paper-raised p-3 shadow-sm ${
        hasIssue ? 'outline outline-2 outline-stamp-red' : ''
      } ${isLoading ? 'animate-pulse' : ''}`}
      title={data.issues.join('\n')}
    >
      <Handle type="target" position={Position.Left} className="!bg-ink-soft" />

      {!running && (
        <button
          onClick={() => removeNode(id)}
          className="nodrag absolute right-1.5 top-1.5 hidden text-ink-soft hover:text-stamp-red group-hover:block"
          title="Delete if"
        >
          <Trash2 size={13} />
        </button>
      )}

      <div className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
        <Split size={12} /> If{data.umurMulai !== undefined ? ` · age ${data.umurMulai}` : ''}
      </div>

      <div className="mt-1.5 flex flex-col gap-0.5">
        {branches.length === 0 ? (
          <span className="font-mono text-[10px] text-ink-soft">drag branches out &rarr;</span>
        ) : (
          branches.map((e) => (
            <div key={e.id} className="truncate font-sans text-[11px] text-ink">
              &bull; {e.label || <span className="italic text-ink-soft">unlabeled branch</span>}
            </div>
          ))
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-ink-soft" />
    </div>
  )
}
