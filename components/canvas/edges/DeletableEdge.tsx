import { useT } from '@/lib/locale'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { edgeLocked, useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'

interface DeletableEdgeData {
  completed?: boolean
  skipped?: boolean
  isIfEdge?: boolean
  conditionLabel?: string
}

export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  animated,
  data,
}: EdgeProps<Edge>) {
  const t = useT()
  const removeEdge = useGraphStore((s) => s.removeEdge)
  const insertNode = useGraphStore((s) => s.insertNode)
  const edge = useGraphStore((s) => s.edges.find((e) => e.id === id))
  const run = useRunStore()
  const running = run.running || run.summaryLoading || run.chapterComplete || !edge || edgeLocked(edge)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<'aksi' | 'tunggu' | 'if' | 'event'>('aksi')
  const [label, setLabel] = useState('')
  const [error, setError] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open) dialog.current?.showModal() }, [open])
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const { completed, skipped, isIfEdge, conditionLabel } = (data as DeletableEdgeData | undefined) ?? {}
  const stroke = skipped ? 'var(--ink-soft)' : animated ? 'var(--stamp-red)' : completed ? 'var(--ink)' : 'var(--ink-soft)'

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth: selected || animated ? 2.5 : 1.5,
          strokeDasharray: skipped ? '4 3' : undefined,
          opacity: skipped ? 0.4 : 1,
        }}
      />
      {/* Kondisi cabang If diedit di node If sendiri (IfNode.tsx) — input biasa
          di dalam node, bukan lewat portal ini. Di sini cuma ditampilin
          read-only biar kebaca langsung di kanvas tanpa perlu klik node. */}
      {isIfEdge && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute whitespace-nowrap rounded-md border border-line bg-paper-raised px-1.5 py-0.5 font-sans text-[10px] text-ink-soft"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {conditionLabel || <span className="italic">{t("unlabeled")}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
      {selected && !running && (
        <EdgeLabelRenderer>
          <div className="edge-tools nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - (isIfEdge ? 30 : 0)}px)` }}>
          <button onClick={() => setOpen(true)} title={t('Insert node')} aria-label={t('Insert node')}><Plus size={15} /></button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeEdge(id)
            }}
            className="text-stamp-red"
            title={t("Delete connection")}
            aria-label={t('Delete connection')}
          >
            <Trash2 size={14} />
          </button>
          </div>
        </EdgeLabelRenderer>
      )}
      {open && <EdgeLabelRenderer><dialog ref={dialog} className="insert-dialog nodrag nopan" onCancel={() => setOpen(false)} aria-label={t('Insert node')}>
        <form onSubmit={(e) => { e.preventDefault(); if (insertNode(id, kind, label)) setOpen(false); else setError(true) }}>
          <div className="insert-heading"><strong>{t('Insert node')}</strong><button type="button" className="icon-button" aria-label={t('Cancel')} title={t('Cancel')} onClick={() => setOpen(false)}><X size={16} /></button></div>
          <label>{t('Node type')}<select value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setError(false) }}>{(['aksi', 'tunggu', 'if', 'event'] as const).map((value) => <option key={value} value={value}>{t({ aksi: 'Decision', tunggu: 'Wait', if: 'If', event: 'Random Event' }[value])}</option>)}</select></label>
          {kind === 'aksi' && <label>{t('Decision name')}<input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} required autoFocus /></label>}
          {error && <p role="alert">{t('Resolve the outstanding issues')}</p>}
          <button className="insert-submit" disabled={running || (kind === 'aksi' && !label.trim())}><Plus size={15} />{t('Add')}</button>
        </form>
      </dialog></EdgeLabelRenderer>}
    </>
  )
}
