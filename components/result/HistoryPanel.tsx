'use client'

import { useT } from '@/lib/locale'
import { useEffect, useRef, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useHistoryStore, type HistoryEntry } from '@/lib/historyStore'
import { LifeCard } from './LifeCard'

export function HistoryPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const entries = useHistoryStore((s) => s.entries)
  const removeEntry = useHistoryStore((s) => s.removeEntry)
  const [viewing, setViewing] = useState<HistoryEntry | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!viewing) dialogRef.current?.showModal()
  }, [viewing])

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
    <dialog ref={dialogRef} className="case-dialog" aria-label={t("Case history")} onCancel={onClose}>
      <div className="case-document flex max-h-[80vh] flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">{t("Case History")}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" title={t("Close")}>
            <X size={16} />
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="font-mono text-xs text-ink-soft">{t('No closed cases yet.')}</p>
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
                  className="p-2 text-ink-soft hover:text-stamp-red"
                  title={t("Delete from history")}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  )
}
