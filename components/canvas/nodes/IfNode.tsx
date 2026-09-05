import { useT } from '@/lib/locale'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Trash2, Split } from 'lucide-react'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'
import type { LifeFlowNodeData } from './shared'

export function IfNode({ id, data }: NodeProps<Node<LifeFlowNodeData>>) {
  const t = useT()
  const removeNode = useGraphStore((s) => s.removeNode)
  const edges = useGraphStore((s) => s.edges)
  const updateEdge = useGraphStore((s) => s.updateEdge)
  const running = useRunStore((s) => s.running || s.summaryLoading || s.lockedNodeIds.includes(id))
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
          className="nodrag absolute right-1.5 top-1.5 p-1 text-ink-soft hover:text-stamp-red"
          title={t("Delete if")}
        >
          <Trash2 size={13} />
        </button>
      )}

      <div className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
        <Split size={12} /> {t("If")}{data.umurMulai !== undefined ? ` / ${t("age")} ${data.umurMulai}` : ''}
      </div>

      <div className="mt-1.5 flex flex-col gap-1">
        {branches.length === 0 ? (
          <span className="font-mono text-[10px] text-ink-soft">{t('No branches yet')}</span>
        ) : (
          branches.map((e) => (
            <input
              aria-label={t("Branch condition")}
              key={e.id}
              className="nodrag w-full rounded-md border border-line bg-transparent px-1.5 py-0.5 font-sans text-[11px] text-ink outline-none placeholder:text-ink-soft disabled:opacity-70"
              value={e.label ?? ''}
              placeholder={t("condition for this branch...")}
              maxLength={60}
              disabled={running}
              onChange={(ev) => updateEdge(e.id, { label: ev.target.value })}
            />
          ))
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-ink-soft" />
    </div>
  )
}
