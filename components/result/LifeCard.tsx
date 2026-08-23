'use client'

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Download, Share2, X } from 'lucide-react'
import type { KondisiAwal, LifeState, RingkasanResponse } from '@/lib/schema'
import { LANE_LABEL } from '@/components/canvas/nodes/shared'

const STAT_ROWS: { key: keyof LifeState; label: string }[] = [
  { key: 'umur', label: 'Age' },
  { key: 'energi', label: 'Energy' },
  { key: 'reputasi', label: 'Reputation' },
  { key: 'kebahagiaan', label: 'Happiness' },
]

function formatRupiah(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}Rp${Math.abs(n).toLocaleString('id-ID')}`
}

export function LifeCard({
  summary,
  kondisiAwal,
  stateAkhir,
  onClose,
}: {
  summary: RingkasanResponse
  kondisiAwal: KondisiAwal
  stateAkhir: LifeState
  onClose: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [caseNo] = useState(() => String(Math.floor(Math.random() * 900000) + 100000))
  const uangDelta = stateAkhir.uang - kondisiAwal.uang

  async function exportPng(): Promise<Blob | null> {
    if (!cardRef.current) return null
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 })
    const res = await fetch(dataUrl)
    return res.blob()
  }

  async function handleDownload() {
    setExporting(true)
    try {
      const blob = await exportPng()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lifeflow-${caseNo}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function handleShare() {
    setExporting(true)
    try {
      const blob = await exportPng()
      const shareText = `${summary.judulHidup} — ${summary.epitaf}`
      const file = blob ? new File([blob], `lifeflow-${caseNo}.png`, { type: 'image/png' }) : null
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText, title: 'Lifeflow' })
      } else if (navigator.share) {
        await navigator.share({ text: shareText, title: 'Lifeflow' })
      } else {
        await navigator.clipboard.writeText(shareText)
      }
    } catch {
      // user cancelled the share sheet — not an error
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="max-h-full w-full max-w-md overflow-y-auto">
        <div ref={cardRef} className="rounded-2xl border-2 border-ink bg-paper-raised p-6">
          <div className="flex items-center justify-between border-b border-dashed border-line pb-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
            <span>Case Closed</span>
            <span>No. {caseNo}</span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight text-ink">{summary.judulHidup}</h1>
          <p className="mt-2 font-display text-sm italic text-ink-soft">&ldquo;{summary.epitaf}&rdquo;</p>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-y border-dashed border-line py-3 font-mono text-[11px] text-ink">
            {STAT_ROWS.map(({ key, label }) => (
              <div key={key} className="flex justify-between">
                <span className="text-ink-soft">{label}</span>
                <span className="font-semibold">{stateAkhir[key] as number}</span>
              </div>
            ))}
            <div className="col-span-2 flex justify-between">
              <span className="text-ink-soft">Funds</span>
              <span className="font-semibold">
                {formatRupiah(stateAkhir.uang)} ({uangDelta >= 0 ? '+' : ''}
                {formatRupiah(uangDelta)})
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {summary.momenPenentu.map((m, i) => (
              <div key={i} className="flex gap-2 font-sans text-xs text-ink">
                <span className="shrink-0 font-mono text-[10px] font-semibold text-ink-soft">
                  EXHIBIT {String.fromCharCode(65 + i)}
                </span>
                <span>{m}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-dashed border-line pt-3">
            {summary.skorPerLane.map((s) => (
              <div key={s.lane} className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  {LANE_LABEL[s.lane]}
                </span>
                <span className="rounded-full border border-ink px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-ink">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex justify-center gap-2">
          <button
            onClick={handleDownload}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-paper-raised px-3 py-1.5 font-mono text-[11px] uppercase text-ink disabled:opacity-50"
          >
            <Download size={13} /> Save PNG
          </button>
          <button
            onClick={handleShare}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-paper-raised px-3 py-1.5 font-mono text-[11px] uppercase text-ink disabled:opacity-50"
          >
            <Share2 size={13} /> Share
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-paper-raised px-3 py-1.5 font-mono text-[11px] uppercase text-ink"
          >
            <X size={13} /> Close
          </button>
        </div>
      </div>
    </div>
  )
}
