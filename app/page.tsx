'use client'

import dynamic from 'next/dynamic'
import { ReactFlowProvider } from '@xyflow/react'
import { useMemo } from 'react'
import { FileText, Play } from 'lucide-react'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'
import { validateGraph } from '@/lib/graph'
import { executeGraph, fetchSummary } from '@/lib/runExecute'
import { NodePalette } from '@/components/canvas/NodePalette'
import { SegmentResult } from '@/components/result/SegmentResult'
import { LifeCard } from '@/components/result/LifeCard'

const Board = dynamic(() => import('@/components/canvas/Board').then((m) => m.Board), { ssr: false })

const STAT_LABEL: { key: 'umur' | 'uang' | 'energi' | 'reputasi' | 'kebahagiaan'; label: string }[] = [
  { key: 'umur', label: 'Age' },
  { key: 'uang', label: 'Funds' },
  { key: 'energi', label: 'Energy' },
  { key: 'reputasi', label: 'Reputation' },
  { key: 'kebahagiaan', label: 'Happiness' },
]

export default function Home() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const kondisiAwal = useGraphStore((s) => s.kondisiAwal)
  const setKondisiAwal = useGraphStore((s) => s.setKondisiAwal)

  const running = useRunStore((s) => s.running)
  const lifeState = useRunStore((s) => s.lifeState)
  const results = useRunStore((s) => s.results)
  const runError = useRunStore((s) => s.error)
  const summary = useRunStore((s) => s.summary)
  const summaryLoading = useRunStore((s) => s.summaryLoading)
  const summaryError = useRunStore((s) => s.summaryError)
  const closeSummary = useRunStore((s) => s.closeSummary)

  const issues = useMemo(() => validateGraph({ nodes, edges }), [nodes, edges])
  const valid = issues.length === 0
  const runFinished = !running && results.length > 0 && lifeState !== null

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-line bg-paper-raised px-4 py-2.5">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <div>
            <div className="font-display text-lg font-semibold leading-none text-ink">Lifeflow</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">Case Intake Form</div>
          </div>

          <label className="flex flex-col gap-0.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">Age at intake</span>
            <input
              type="number"
              className="w-16 rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-xs text-ink outline-none"
              value={kondisiAwal.umur}
              disabled={running}
              onChange={(e) => setKondisiAwal({ umur: Number(e.target.value) })}
            />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">Starting funds</span>
            <input
              type="number"
              className="w-28 rounded-md border border-line bg-paper px-1.5 py-0.5 font-mono text-xs text-ink outline-none"
              value={kondisiAwal.uang}
              disabled={running}
              onChange={(e) => setKondisiAwal({ uang: Number(e.target.value) })}
            />
          </label>

          <label className="flex flex-1 min-w-40 flex-col gap-0.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">Background note</span>
            <input
              type="text"
              maxLength={140}
              className="w-full rounded-md border border-line bg-paper px-1.5 py-0.5 font-sans text-xs text-ink outline-none"
              value={kondisiAwal.latarBelakang}
              disabled={running}
              onChange={(e) => setKondisiAwal({ latarBelakang: e.target.value })}
            />
          </label>

          <button
            disabled={!valid || running}
            title={valid ? undefined : issues.map((i) => i.pesan).join('\n')}
            onClick={() => executeGraph(nodes, edges, kondisiAwal)}
            className="flex items-center gap-1.5 rounded-lg border border-ink bg-ink px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-paper disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-ink-soft"
          >
            <Play size={12} /> {running ? 'Running…' : 'Execute'}
          </button>

          {runFinished && (
            <button
              onClick={() => fetchSummary(kondisiAwal, lifeState)}
              disabled={summaryLoading}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-ink disabled:opacity-50"
            >
              <FileText size={12} /> {summaryLoading ? 'Filing…' : 'Close the case'}
            </button>
          )}
        </div>
      </header>

      {!valid && (
        <div className="border-b border-stamp-red/40 bg-stamp-red/10 px-4 py-1 font-mono text-[11px] text-stamp-red">
          {issues.map((issue, i) => (
            <div key={i}>{issue.pesan}</div>
          ))}
        </div>
      )}

      {(runError || summaryError) && (
        <div className="border-b border-stamp-red/40 bg-stamp-red/10 px-4 py-1 font-mono text-[11px] text-stamp-red">
          {runError ?? summaryError}
        </div>
      )}

      {lifeState && (
        <div className="flex flex-wrap gap-4 border-b border-line bg-paper px-4 py-1.5 font-mono text-[11px] text-ink">
          {STAT_LABEL.map(({ key, label }) => (
            <span key={key}>
              <span className="text-ink-soft">{label}:</span>{' '}
              {key === 'uang' ? lifeState[key].toLocaleString('id-ID') : lifeState[key]}
            </span>
          ))}
          {!lifeState.hidup && <span className="font-semibold text-stamp-red">Deceased</span>}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <ReactFlowProvider>
          <Board />
        </ReactFlowProvider>
        {results.length > 0 && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-line bg-paper p-3">
            <h2 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
              Case File
            </h2>
            <div className="flex flex-col gap-2">
              {results.map((r, i) => (
                <SegmentResult key={r.segmentId} result={r} index={i} />
              ))}
            </div>
          </aside>
        )}
      </div>

      {summary && lifeState && (
        <LifeCard summary={summary} kondisiAwal={kondisiAwal} stateAkhir={lifeState} onClose={closeSummary} />
      )}
    </div>
  )
}
