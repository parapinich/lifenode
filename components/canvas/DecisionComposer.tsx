'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'
import { useT } from '@/lib/locale'
import type { Lane } from '@/lib/schema'
import { LANE_LABEL } from './nodes/shared'

export function DecisionComposer({ anchor, mode = 'after', onAdded }: { anchor?: string; mode?: 'after' | 'parallel'; onAdded?: () => void }) {
  const t = useT()
  const [label, setLabel] = useState('')
  const [lane, setLane] = useState<Lane>('chaos')
  const { running, chapterComplete, summaryLoading, lifeState, nextSyncId } = useRunStore()
  const { addDecision, nextChapter, nodes } = useGraphStore()
  const pendingChoice = !anchor && nodes.some((n) => n.id === nextSyncId && (n.kind === 'if' || n.kind === 'event'))
  if (lifeState?.hidup === false) return null
  return <form className="decision-composer nodrag nopan" onSubmit={(e) => {
    e.preventDefault()
    if (running || summaryLoading || pendingChoice || !label.trim()) return
    if (chapterComplete) nextChapter(label, lane)
    else addDecision(label, lane, anchor, mode)
    setLabel('')
    onAdded?.()
  }}>
    <label><span className="eyebrow">{t(chapterComplete ? 'What happens next?' : 'Your decision')}</span><textarea aria-label={t('Your decision')} placeholder={t(pendingChoice ? 'Continue chapter' : 'Write your own decision...')} value={label} maxLength={60} rows={2} required disabled={running || summaryLoading || pendingChoice} onChange={(e) => setLabel(e.target.value)} /></label>
    <div><select aria-label={t('Decision category')} value={lane} onChange={(e) => setLane(e.target.value as Lane)} disabled={running || summaryLoading || pendingChoice}>{Object.entries(LANE_LABEL).map(([key, value]) => <option key={key} value={key}>{t(value)}</option>)}</select><button type="submit" title={t(chapterComplete ? 'New chapter' : 'Add')} aria-label={t(chapterComplete ? 'New chapter' : 'Add')} disabled={running || summaryLoading || pendingChoice || !label.trim()}><Plus size={17} /></button></div>
  </form>
}
