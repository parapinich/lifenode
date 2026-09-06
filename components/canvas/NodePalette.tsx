import { useT } from '@/lib/locale'
import { BriefcaseBusiness, Heart, Activity, Shuffle, Dices, Hourglass, Split, Plus, X, FileText } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useRunStore } from '@/lib/runStore'
import { useGraphStore } from '@/lib/store'
import type { Lane } from '@/lib/schema'
import { LANE_LABEL, LANE_STYLE } from './nodes/shared'
import { DecisionComposer } from './DecisionComposer'

const PRESETS: Record<Lane, string[]> = {
  karir: ['Take an office job', 'Quit on a whim', 'Start a business'],
  relasi: ['Start dating', 'Get married', 'Break up'],
  kesehatan: ['Work out regularly', 'Pull all-nighters', 'Get a checkup'],
  chaos: ['Join an MLM', 'Gamble on crypto', 'Adopt 10 cats'],
}
const ICONS = { karir: BriefcaseBusiness, relasi: Heart, kesehatan: Activity, chaos: Shuffle }
export type PaletteDragPayload =
  | { type: 'aksi'; lane: Lane; label: string }
  | { type: 'tunggu' } | { type: 'if' } | { type: 'event' }

export function NodePalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const running = useRunStore((s) => s.running || s.summaryLoading || s.chapterComplete)
  const busy = useRunStore((s) => s.running || s.summaryLoading)
  const { addDecision, addTungguNode, addIfNode, addEventNode, loadTemplate } = useGraphStore()
  const { screenToFlowPosition } = useReactFlow()

  function add(payload: PaletteDragPayload) {
    if (running) return
    const bounds = document.querySelector('.react-flow')?.getBoundingClientRect()
    if (!bounds) return
    const pos = screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
    if (payload.type === 'aksi') addDecision(t(payload.label), payload.lane)
    else if (payload.type === 'tunggu') addTungguNode(pos.x - 80, pos.y - 40)
    else if (payload.type === 'if') addIfNode(pos.x - 104, pos.y - 40)
    else addEventNode(pos.x - 110, pos.y - 40)
    onClose()
  }
  function drag(e: React.DragEvent, payload: PaletteDragPayload) {
    e.dataTransfer.setData('application/lifenode-node', JSON.stringify(payload.type === 'aksi' ? { ...payload, label: t(payload.label) } : payload))
    e.dataTransfer.effectAllowed = 'move'
  }
  return (
    <aside className={`decision-palette ${open ? 'is-open' : ''}`} aria-label={t("Decision catalog")}>
      <div className="panel-heading"><div><span className="eyebrow">{t("Material evidence")}</span><h2>{t("Decisions")}</h2></div><button className="icon-button mobile-panel-button" aria-label={t("Close decision catalog")} title={t("Close decision catalog")} onClick={onClose}><X size={17} /></button></div>
      <div className="palette-scroll">
        <DecisionComposer onAdded={onClose} />
        {(Object.keys(PRESETS) as Lane[]).map((lane, index) => {
          const Icon = ICONS[lane]
          return <section key={lane} className="decision-group">
            <h3 className={LANE_STYLE[lane].text}><Icon size={14} /><span>{t(LANE_LABEL[lane])}</span><small>0{index + 1}</small></h3>
            {PRESETS[lane].map((label) => <button key={label} className="decision-option" draggable={!running} disabled={running} title={`${t("Add")}: ${t(label)}`} onDragStart={(e) => drag(e, { type: 'aksi', lane, label })} onClick={() => add({ type: 'aksi', lane, label })}><span>{t(label)}</span><Plus size={13} /></button>)}
          </section>
        })}
        <section className="decision-group timing-group"><h3>{t("Time & contingencies")}</h3>{([
          ['tunggu', t("Wait"), Hourglass], ['if', t("If"), Split], ['event', t("Random Event"), Dices],
        ] as const).map(([type, label, Icon]) => <button key={type} className="decision-option" draggable={!running} disabled={running} onDragStart={(e) => drag(e, { type })} onClick={() => add({ type })}><Icon size={14} /><span>{t(label)}</span><Plus size={13} /></button>)}</section>
      </div>
      <button className="example-button" onClick={() => { loadTemplate(); onClose() }} disabled={busy}><FileText size={15} /> {t("Open an example case")}</button>
    </aside>
  )
}
