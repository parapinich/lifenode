import { GitMerge } from 'lucide-react'
import type { Lane } from '@/lib/schema'
import { LANE_LABEL, LANE_STYLE } from './nodes/shared'

const PRESETS: Record<Lane, string[]> = {
  karir: ['Take an office job', 'Quit on a whim', 'Start a business'],
  relasi: ['Start dating', 'Get married', 'Break up'],
  kesehatan: ['Work out regularly', 'Pull all-nighters', 'Get a checkup'],
  chaos: ['Join an MLM', 'Gamble on crypto', 'Adopt 10 cats'],
}

export type PaletteDragPayload = { type: 'aksi'; lane: Lane; label: string } | { type: 'merge' }

function onDragStart(e: React.DragEvent, payload: PaletteDragPayload) {
  e.dataTransfer.setData('application/lifeflow-node', JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'move'
}

export function NodePalette() {
  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-line bg-paper-raised p-3">
      <h2 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
        Decision Catalog
      </h2>

      {(Object.keys(PRESETS) as Lane[]).map((lane) => {
        const style = LANE_STYLE[lane]
        return (
          <div key={lane} className="mb-4">
            <div className={`mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider ${style.text}`}>
              {LANE_LABEL[lane]}
            </div>
            <div className="flex flex-col gap-1">
              {PRESETS[lane].map((label) => (
                <div
                  key={label}
                  draggable
                  onDragStart={(e) => onDragStart(e, { type: 'aksi', lane, label })}
                  className={`cursor-grab rounded-lg border border-l-4 ${style.border} bg-paper px-2 py-1.5 font-sans text-xs text-ink`}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div className="mb-1 mt-5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
        Sync point
      </div>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, { type: 'merge' })}
        className="flex cursor-grab items-center gap-1.5 rounded-full border border-ink bg-ink px-3 py-1.5 font-mono text-xs text-paper"
      >
        <GitMerge size={13} /> Merge
      </div>
    </aside>
  )
}
