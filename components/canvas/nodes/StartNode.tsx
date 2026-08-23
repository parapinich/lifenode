import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { LifeFlowNodeData } from './shared'

export function StartNode({ data }: NodeProps<Node<LifeFlowNodeData>>) {
  const hasIssue = data.issues.length > 0
  return (
    <div
      className={`border-2 border-ink bg-ink px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-paper shadow-sm ${
        hasIssue ? 'outline outline-2 outline-stamp-red' : ''
      }`}
      title={data.issues.join('\n')}
    >
      Intake{data.umurSelesai !== undefined ? ` · age ${data.umurSelesai}` : ''}
      <Handle type="source" position={Position.Right} className="!bg-paper" />
    </div>
  )
}
