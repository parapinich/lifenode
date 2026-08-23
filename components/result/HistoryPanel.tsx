'use client'

import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useHistoryStore, type HistoryEntry } from '@/lib/historyStore'
import { LifeCard } from './LifeCard'

export function HistoryPanel({ onClose }: { onClose: () => void }) {
  const entries = useHistoryStore((s) => s.entries)
  const removeEntry = useHistoryStore((s) => s.removeEntry)
  const [viewing, setViewing] = useState<HistoryEntry | null>(null)

  if (viewing) {
    return (
      <LifeCard
        summary={viewing.summary}
        kondisiAwal={viewing.kondisiAwal}
        stateAkhir={viewing.stateAkhir}
        onClose={() => setViewing(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border-2 border-ink bg-paper-raised p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Case History</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" title="Close">
            <X size={16} />
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="font-mono text-xs text-ink-soft">No closed cases yet — run a life to file one.</p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {entries.map((e) => (
              <li
                key={e.id}
                className="group flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2"
              >
                <button onClick={() => setViewing(e)} className="flex-1 text-left">
                  <div className="font-display text-sm font-semibold text-ink">{e.summary.judulHidup}</div>
                  <div className="font-mono text-[10px] text-ink-soft">
                    {new Date(e.timestamp).toLocaleDateString()}
                  </div>
                </button>
                <button
                  onClick={() => removeEntry(e.id)}
                  className="text-ink-soft opacity-0 hover:text-stamp-red group-hover:opacity-100"
                  title="Delete from history"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
