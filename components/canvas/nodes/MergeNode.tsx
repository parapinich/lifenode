import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Trash2, GitMerge } from 'lucide-react'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'
import type { LifeFlowNodeData } from './shared'

export function MergeNode({ id, data }: NodeProps<Node<LifeFlowNodeData>>) {
  const removeNode = useGraphStore((s) => s.removeNode)
  const running = useRunStore((s) => s.running)
  const hasIssue = data.issues.length > 0
  const isLoading = data.runStatus === 'loading'

  return (
    <div
      className={`group relative flex items-center gap-1.5 rounded-full border border-line bg-ink px-3.5 py-2 text-paper shadow-sm ${
        hasIssue ? 'outline outline-2 outline-stamp-red' : ''
      } ${isLoading ? 'animate-pulse' : ''}`}
      title={data.issues.join('\n')}
    >
      <Handle type="target" position={Position.Left} className="!bg-paper" />
      <GitMerge size={13} className="shrink-0" />
      <span className="font-mono text-[11px] uppercase tracking-wider">
        Sync{data.umurMulai !== undefined ? ` · age ${data.umurMulai}` : ''}
      </span>
      {!running && (
        <button
          onClick={() => removeNode(id)}
          className="nodrag absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-stamp-red text-paper group-hover:flex"
          title="Delete step"
        >
          <Trash2 size={11} />
        </button>
      )}
      <Handle type="source" position={Position.Right} className="!bg-paper" />
    </div>
  )
}
