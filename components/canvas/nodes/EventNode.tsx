import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Dices, Trash2 } from 'lucide-react'
import { useT } from '@/lib/locale'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'
import type { LifeFlowNodeData } from './shared'

export function EventNode({ id, data }: NodeProps<Node<LifeFlowNodeData>>) {
  const t = useT()
  const run = useRunStore()
  const remove = useGraphStore((s) => s.removeNode)
  const locked = run.running || run.summaryLoading || run.lockedNodeIds.includes(id)
  return <div className="relative w-56 border border-l-4 border-line border-l-lane-chaos bg-paper-raised p-3 text-ink" title={data.issues.join('\n')}>
    <Handle type="target" position={Position.Left} />
    <div className="flex items-center gap-2 pr-4 font-mono text-xs text-lane-chaos"><Dices size={16} />{t('Random Event')}</div>
    <div className="mt-3 font-mono text-xs">{t('age')} {data.umurMulai}</div>
    {!locked && <button className="nodrag absolute right-1 top-1 p-1" title={t('Delete step')} aria-label={t('Delete step')} onClick={() => remove(id)}><Trash2 size={13} /></button>}
    <Handle type="source" position={Position.Right} />
  </div>
}
