import { useT } from '@/lib/locale'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { DecisionComposer } from '../DecisionComposer'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'
import { LANE_LABEL, LANE_STYLE, type LifeFlowNodeData } from './shared'
import { Stamp } from './Stamp'
import type { Lane, StatusNode } from '@/lib/schema'

export function AksiNode({ id, data }: NodeProps<Node<LifeFlowNodeData>>) {
  const t = useT()
  const updateNode = useGraphStore((s) => s.updateNode)
  const removeNode = useGraphStore((s) => s.removeNode)
  const running = useRunStore((s) => s.running || s.summaryLoading || s.lockedNodeIds.includes(id))
  const [adding, setAdding] = useState<'after' | 'parallel' | null>(null)
  const lane = data.lane ?? 'chaos'
  const style = LANE_STYLE[lane]
  const isSkipped = data.runStatus === 'skipped'
  const hasIssue = data.issues.length > 0 && !isSkipped
  const isLoading = data.runStatus === 'loading'
  const isDone = data.runStatus === 'sukses' || data.runStatus === 'separuh' || data.runStatus === 'gagal'

  return (
    <div
      className={`group relative w-60 rounded-xl border border-l-4 ${style.border} bg-paper-raised p-3 shadow-sm ${
        hasIssue ? 'outline outline-2 outline-stamp-red' : ''
      } ${isLoading ? 'animate-pulse' : ''} ${isSkipped ? 'opacity-40 grayscale' : ''}`}
      title={[...data.issues, data.runStatus === 'gagal' ? t("This step failed") : '', isSkipped ? t("This branch was not taken") : ''].filter(Boolean).join('\n')}
    >
      <Handle type="target" position={Position.Left} className="!bg-ink-soft" />

      {!running && (
        <button
          onClick={() => removeNode(id)}
          className="nodrag absolute right-1.5 top-1.5 p-1 text-ink-soft hover:text-stamp-red"
          title={t("Delete step")}
        >
          <Trash2 size={13} />
        </button>
      )}

      <div className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${style.text}`}>
        {t(LANE_LABEL[lane])}
      </div>

      <input
        aria-label={t("Decision name")}
        className="nodrag mt-0.5 w-full bg-transparent font-sans text-sm font-medium text-ink outline-none placeholder:text-ink-soft disabled:opacity-70"
        value={data.label ?? ''}
        placeholder={t("Name this decision...")}
        maxLength={60}
        disabled={running}
        onChange={(e) => updateNode(id, { label: e.target.value })}
      />

      <div className="mt-2.5 flex items-center gap-2">
        <select
          aria-label={t("Decision category")}
          className="nodrag rounded-md border border-line bg-transparent font-mono text-[10px] uppercase text-ink-soft disabled:opacity-70"
          value={lane}
          disabled={running}
          onChange={(e) => updateNode(id, { lane: e.target.value as Lane })}
        >
          {(Object.keys(LANE_LABEL) as Lane[]).map((l) => (
            <option key={l} value={l}>
              {t(LANE_LABEL[l])}
            </option>
          ))}
        </select>
      </div>

      <textarea
        aria-label={t("Decision description")}
        className="nodrag mt-2 w-full resize-none rounded-md border border-line bg-transparent p-1 font-sans text-[11px] text-ink outline-none placeholder:text-ink-soft disabled:opacity-70"
        rows={2}
        value={data.note ?? ''}
        placeholder={t("Description (optional)...")}
        maxLength={140}
        disabled={running}
        onChange={(e) => updateNode(id, { note: e.target.value })}
      />

      <div className="mt-2 flex items-center gap-2">
        <label className="flex items-center gap-2 font-mono text-[10px] text-ink-soft">{t('Duration')}<input className="nodrag w-14 rounded border border-line p-1" aria-label={t('Decision duration')} type="number" min={0.5} max={15} step={0.5} value={data.durasi ?? 1} disabled={running} onChange={(e) => updateNode(id, { durasi: Number(e.target.value) })} />{t('Years')}</label>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-[10px] text-ink-soft">{t("Intensity")}</span>
        <input
          type="range"
          aria-label={t("Decision intensity")}
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
            {t("age")} {data.umurMulai} &rarr; {data.umurSelesai}
          </span>
        ) : (
          <span />
        )}
        {isDone && <Stamp status={data.runStatus as StatusNode} className="text-[9px]" />}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-ink-soft" />
      {!running && <div className="node-next nodrag"><button onClick={() => setAdding(adding === 'after' ? null : 'after')}>{t('After this')}</button><button onClick={() => setAdding(adding === 'parallel' ? null : 'parallel')}>{t('Meanwhile')}</button></div>}
      {adding && !running && <div className="node-composer nodrag nopan"><button className="icon-button" title={t('Close')} aria-label={t('Close')} onClick={() => setAdding(null)}><X size={14} /></button><DecisionComposer anchor={id} mode={adding} onAdded={() => setAdding(null)} /></div>}
    </div>
  )
}
