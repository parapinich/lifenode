import type { SegmentResultView } from '@/lib/runStore'
import type { StatusNode } from '@/lib/schema'
import { Stamp } from '@/components/canvas/nodes/Stamp'

export function SegmentResult({ result, index }: { result: SegmentResultView; index: number }) {
  return (
    <div className="border border-line bg-paper-raised p-3">
      <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
        Segment {index + 1}
      </div>
      <p className="font-sans text-sm leading-relaxed text-ink">{result.narasiSegmen}</p>

      {result.perNode.length > 0 && (
        <ul className="mt-2.5 space-y-1.5 border-t border-dashed border-line pt-2">
          {result.perNode.map((n) => (
            <li key={n.nodeId} className="flex items-start gap-2 text-xs text-ink-soft">
              <Stamp status={n.status as StatusNode} className="mt-0.5 shrink-0 text-[9px]" />
              <span>
                {n.teks}
                {n.alasan ? <span className="italic"> ({n.alasan})</span> : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result.narasiGap.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-dashed border-line pt-2">
          {result.narasiGap.map((g, i) => (
            <li key={i} className="font-mono text-[11px] italic text-ink-soft">
              {g.lane}: {g.teks}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
