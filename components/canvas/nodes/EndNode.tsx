import { useT } from '@/lib/locale'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { LifeFlowNodeData } from './shared'
import { useRunStore } from '@/lib/runStore'

export function EndNode({ data }: NodeProps<Node<LifeFlowNodeData>>) {
  const t = useT()
  const deceased = useRunStore((s) => s.lifeState?.hidup === false)
  const hasIssue = data.issues.length > 0
  return (
    <div
      className={`rounded-full border-2 border-ink bg-ink px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-paper shadow-sm ${
        hasIssue ? 'outline outline-2 outline-stamp-red' : ''
      }`}
      title={data.issues.join('\n')}
    >
      <Handle type="target" position={Position.Left} className="!bg-paper" />
      {t(deceased ? 'Life ended' : 'Case Closed')}{data.umurMulai !== undefined ? ` / ${t("age")} ${data.umurMulai}` : ''}
    </div>
  )
}
