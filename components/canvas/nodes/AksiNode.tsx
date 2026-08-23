import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Trash2 } from 'lucide-react'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'
import { LANE_LABEL, LANE_STYLE, type LifeFlowNodeData } from './shared'
import { Stamp } from './Stamp'
import type { Lane, StatusNode } from '@/lib/schema'

export function AksiNode({ id, data }: NodeProps<Node<LifeFlowNodeData>>) {
  const updateNode = useGraphStore((s) => s.updateNode)
  const removeNode = useGraphStore((s) => s.removeNode)
  const running = useRunStore((s) => s.running)
  const lane = data.lane ?? 'chaos'
  const style = LANE_STYLE[lane]
  const hasIssue = data.issues.length > 0
  const isLoading = data.runStatus === 'loading'
  const isDone = data.runStatus === 'sukses' || data.runStatus === 'separuh' || data.runStatus === 'gagal'

  return (
    <div
      className={`group relative w-60 rounded-xl border border-l-4 ${style.border} bg-paper-raised p-3 shadow-sm ${
        hasIssue ? 'outline outline-2 outline-stamp-red' : ''
      } ${isLoading ? 'animate-pulse' : ''}`}
      title={[...data.issues, data.runStatus === 'gagal' ? 'This step failed' : ''].filter(Boolean).join('\n')}
    >
      <Handle type="target" position={Position.Left} className="!bg-ink-soft" />

      {!running && (
        <button
          onClick={() => removeNode(id)}
          className="nodrag absolute right-1.5 top-1.5 hidden text-ink-soft hover:text-stamp-red group-hover:block"
          title="Delete step"
        >
          <Trash2 size={13} />
        </button>
      )}

      <div className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${style.text}`}>
        {LANE_LABEL[lane]}
      </div>

      <input
        className="nodrag mt-0.5 w-full bg-transparent font-sans text-sm font-medium text-ink outline-none placeholder:text-ink-soft disabled:opacity-70"
        value={data.label ?? ''}
        placeholder="Name this decision..."
        maxLength={60}
        disabled={running}
        onChange={(e) => updateNode(id, { label: e.target.value })}
      />

      <div className="mt-2.5 flex items-center gap-2">
        <select
          className="nodrag rounded-md border border-line bg-transparent font-mono text-[10px] uppercase text-ink-soft disabled:opacity-70"
          value={lane}
          disabled={running}
          onChange={(e) => updateNode(id, { lane: e.target.value as Lane })}
        >
          {(Object.keys(LANE_LABEL) as Lane[]).map((l) => (
            <option key={l} value={l}>
              {LANE_LABEL[l]}
            </option>
          ))}
        </select>
      </div>

      <textarea
        className="nodrag mt-2 w-full resize-none rounded-md border border-line bg-transparent p-1 font-sans text-[11px] text-ink outline-none placeholder:text-ink-soft disabled:opacity-70"
        rows={2}
        value={data.note ?? ''}
        placeholder="Description (optional)..."
        maxLength={140}
        disabled={running}
        onChange={(e) => updateNode(id, { note: e.target.value })}
      />

      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-[10px] text-ink-soft">Intensity</span>
        <input
          type="range"
          min={1}
          max={3}
          step={1}
          className="nodrag h-3 flex-1 accent-ink disabled:opacity-70"
          value={data.intensity ?? 1}
          disabled={running}
          onChange={(e) => updateNode(id, { intensity: Number(e.target.value) as 1 | 2 | 3 })}
        />
        <span className="font-mono text-[10px] font-semibold text-ink">{data.intensity ?? 1}</span>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-dashed border-line pt-1.5">
        {data.umurMulai !== undefined ? (
          <span className="font-mono text-[10px] text-ink-soft">
            age {data.umurMulai} &rarr; {data.umurSelesai}
          </span>
        ) : (
          <span />
        )}
        {isDone && <Stamp status={data.runStatus as StatusNode} className="text-[9px]" />}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-ink-soft" />
    </div>
  )
}
