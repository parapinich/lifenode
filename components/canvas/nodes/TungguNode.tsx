import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Trash2, Hourglass } from 'lucide-react'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'
import type { LifeFlowNodeData } from './shared'

export function TungguNode({ id, data }: NodeProps<Node<LifeFlowNodeData>>) {
  const updateNode = useGraphStore((s) => s.updateNode)
  const removeNode = useGraphStore((s) => s.removeNode)
  const running = useRunStore((s) => s.running)
  const isSkipped = data.runStatus === 'skipped'
  const hasIssue = data.issues.length > 0 && !isSkipped

  return (
    <div
      className={`group relative w-40 rounded-xl border border-dashed border-ink-soft bg-paper p-2.5 shadow-sm ${
        hasIssue ? 'outline outline-2 outline-stamp-red' : ''
      } ${isSkipped ? 'opacity-40 grayscale' : ''}`}
      title={isSkipped ? 'This branch was not taken' : data.issues.join('\n')}
    >
      <Handle type="target" position={Position.Left} className="!bg-ink-soft" />

      {!running && (
        <button
          onClick={() => removeNode(id)}
          className="nodrag absolute right-1.5 top-1.5 hidden text-ink-soft hover:text-stamp-red group-hover:block"
          title="Delete wait"
        >
          <Trash2 size={13} />
        </button>
      )}

      <div className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
        <Hourglass size={11} /> Wait
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={15}
          className="nodrag w-12 rounded-md border border-line bg-transparent px-1 font-mono text-[11px] text-ink disabled:opacity-70"
          value={data.durasi ?? 1}
          disabled={running}
          onChange={(e) => updateNode(id, { durasi: Number(e.target.value) })}
        />
        <span className="font-mono text-[10px] text-ink-soft">yrs</span>
      </div>

      {data.umurMulai !== undefined && (
        <div className="mt-1.5 border-t border-dashed border-line pt-1">
          <span className="font-mono text-[10px] text-ink-soft">
            age {data.umurMulai} &rarr; {data.umurSelesai}
          </span>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-ink-soft" />
    </div>
  )
}
