'use client'

import { useT, useLocaleStore, formatMoney } from '@/lib/locale'
import { useThemeStore } from '@/lib/theme'
import { Moon, Sun } from 'lucide-react'
import dynamic from 'next/dynamic'
import { ReactFlowProvider } from '@xyflow/react'
import { useEffect, useMemo, useState } from 'react'
import { Activity, Dices, FileText, History, LayoutGrid, LoaderCircle, PanelLeft, PanelRight, Play, Plus, Redo2, RotateCcw, Undo2, X } from 'lucide-react'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'
import { validateGraph } from '@/lib/graph'
import { KondisiAwalSchema } from '@/lib/schema'
import { executeGraph, fetchSummary } from '@/lib/runExecute'
import { randomBackstory } from '@/lib/nodeExamples'
import { NodePalette } from '@/components/canvas/NodePalette'
import { DecisionComposer } from '@/components/canvas/DecisionComposer'
import { SegmentResult } from '@/components/result/SegmentResult'
import { LifeCard } from '@/components/result/LifeCard'
import { HistoryPanel } from '@/components/result/HistoryPanel'
import { EventResponse } from '@/components/result/EventResponse'

const Board = dynamic(() => import('@/components/canvas/Board').then((m) => m.Board), {
  ssr: false,
  loading: () => <div className="board-loading" role="status"><LoaderCircle className="animate-spin" aria-label="Lifenode" /></div>,
})
const STATS = [
  { key: 'umur', label: 'Age' }, { key: 'uang', label: 'Funds' },
  { key: 'energi', label: 'Energy' }, { key: 'reputasi', label: 'Reputation' },
  { key: 'kebahagiaan', label: 'Happiness' },
] as const

export default function Home() {
  const t = useT()
  const { theme, toggle } = useThemeStore()
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  const { language, setLanguage } = useLocaleStore()
  const { nodes, edges, kondisiAwal, setKondisiAwal, loadTemplate, applyAutoLayout, undo, redo, past, future } = useGraphStore()
  const { running, lifeState, results, error: runError, summary, summaryLoading, summaryError, closeSummary, chapterComplete, initialConditions, reset } = useRunStore()
  const [showComposer, setShowComposer] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const issues = useMemo(() => validateGraph({ nodes, edges }, language), [nodes, edges, language])
  const intakeValid = KondisiAwalSchema.safeParse(kondisiAwal).success
  const valid = issues.length === 0 && intakeValid
  const runFinished = !running && !runError && results.length > 0 && lifeState !== null
  const decisions = nodes.filter((n) => n.kind === 'aksi').length
  const stats = lifeState ?? { ...kondisiAwal, energi: 100, reputasi: 50, kebahagiaan: 50 }
  const waitingForEvent = useRunStore((s) => !!s.nextSyncId && !!s.events[s.nextSyncId]?.data && s.events[s.nextSyncId]?.choice === undefined)
  useEffect(() => { document.documentElement.lang = language }, [language])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (running || (e.target instanceof HTMLElement && e.target.closest('input, select, textarea, [contenteditable="true"], dialog'))) return
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, running])

  return (
    <main className="life-app">
      <header className="masthead">
        <div className="brand"><Activity aria-hidden="true" size={27} /><h1>Lifenode<span>.</span></h1></div>
        <span className="masthead-note">{t("Department of possible futures")}</span>
        <button className="icon-button theme-toggle" onClick={toggle} aria-label={t(theme === 'light' ? 'Dark mode' : 'Light mode')} title={t(theme === 'light' ? 'Dark mode' : 'Light mode')}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button>
        <button className="history-button" aria-label={t('Case history')} title={t('Case history')} onClick={() => setShowHistory(true)}><History size={16} /> <span>{t("Case history")}</span></button>
        <div className="language-switch" role="group" aria-label={t('Language')}><button aria-pressed={language === 'en'} onClick={() => setLanguage('en')} lang="en">EN</button><button aria-pressed={language === 'id'} onClick={() => setLanguage('id')} lang="id">ID</button></div>
      </header>
      <section className="intake-strip" aria-label={t("Starting conditions")}>
        <div className="intake-label"><span className="eyebrow">{t("01 / The subject")}</span><strong>{t("Initial conditions")}</strong></div>
        <label><span>{t("Age")}</span><input aria-label={t("Age at intake")} type="number" min={0} max={100} value={kondisiAwal.umur} disabled={running || !!lifeState} onChange={(e) => setKondisiAwal({ umur: Number(e.target.value) })} /></label>
        <label className="funds-input"><span>{t("Starting funds / $")}</span><input type="number" lang={language === 'id' ? 'id-ID' : 'en-US'} value={kondisiAwal.uang} disabled={running || !!lifeState} onChange={(e) => setKondisiAwal({ uang: Number(e.target.value) })} /></label>
        <label className="background-input"><span>{t("Background note")}</span><div><input type="text" maxLength={140} placeholder={t("An ordinary person. For now.")} value={kondisiAwal.latarBelakang} disabled={running || !!lifeState} onChange={(e) => setKondisiAwal({ latarBelakang: e.target.value })} /><button type="button" className="icon-button" title={t("Randomize background note")} aria-label={t("Randomize background note")} disabled={running || !!lifeState} onClick={() => setKondisiAwal({ latarBelakang: randomBackstory(language) })}><Dices size={17} /></button></div></label>
      </section>
      <ReactFlowProvider>
        <div className="workspace">
          <NodePalette open={showPalette} onClose={() => setShowPalette(false)} />
          <section className="canvas-column" aria-label={t("Life plan")}>
            <div className="canvas-toolbar">
              <div className="canvas-title"><span className="eyebrow">{t("02 / The plan")}</span><h2>{t("A life, pending.")}</h2></div>
              <div className="canvas-actions">
                <button className="icon-button mobile-panel-button catalog-trigger" title={t("Decision catalog")} aria-label={t("Decision catalog")} aria-expanded={showPalette} onClick={() => { setShowPalette(!showPalette); setShowResults(false) }}><PanelLeft size={17} /></button>
                <button className="icon-button" title={t('Your decision')} aria-label={t('Your decision')} onClick={() => setShowComposer(!showComposer)} aria-expanded={showComposer} disabled={running || summaryLoading || lifeState?.hidup === false}><Plus size={17} /></button>
                {!lifeState ? <><button className="icon-button" title={t("Undo (Ctrl+Z)")} aria-label={t("Undo")} onClick={undo} disabled={!past.length || running}><Undo2 size={17} /></button>
                <button className="icon-button" title={t("Redo (Ctrl+Shift+Z)")} aria-label={t("Redo")} onClick={redo} disabled={!future.length || running}><Redo2 size={17} /></button></> : <button className="icon-button" title={t('New life')} aria-label={t('New life')} disabled={running || summaryLoading} onClick={() => { if (window.confirm(t('Restart this life? The current progress will be cleared.'))) { reset(); setShowResults(false) } }}><RotateCcw size={17} /></button>}
                <button className="icon-button" title={t("Tidy up node positions")} aria-label={t("Tidy up node positions")} onClick={applyAutoLayout} disabled={running || issues.length > 0}><LayoutGrid size={17} /></button>
                <button className="icon-button mobile-panel-button" title={t("Case file")} aria-label={t("Case file")} aria-expanded={showResults} onClick={() => { setShowResults(!showResults); setShowPalette(false) }}><PanelRight size={17} /></button>
                <button className="execute-button" disabled={!valid || running || summaryLoading || chapterComplete || lifeState?.hidup === false} onClick={() => { setShowResults(true); setShowPalette(false); setShowComposer(false); void executeGraph(nodes, edges, kondisiAwal) }} title={valid ? t("Execute life plan") : t("Resolve the outstanding issues")}>
                  {running ? <LoaderCircle className="animate-spin" size={15} /> : <Play size={15} fill="currentColor" />}<span>{t(running ? 'Unfolding...' : waitingForEvent ? 'Choose a response' : chapterComplete ? 'Chapter complete' : runError ? 'Try again' : lifeState ? 'Continue chapter' : 'Run chapter')}</span>
                </button>
              </div>
            </div>
            {(!valid || runError || summaryError) && (
              <div className="case-alert" role={runError || summaryError ? 'alert' : undefined}>
                {runError || summaryError || (!intakeValid ? t("Age must be between 0 and 100. Check the starting conditions.") : (
                  <details><summary>{issues.length} {t('issues to resolve')}</summary>{issues.map((issue, i) => <p key={i}>{issue.pesan}</p>)}</details>
                ))}
              </div>
            )}
            <div className="canvas-surface">
              <Board />
              {showComposer && <div className="canvas-composer"><button className="icon-button" title={t('Close')} aria-label={t('Close')} onClick={() => setShowComposer(false)}><X size={16} /></button><DecisionComposer onAdded={() => { setShowComposer(false); applyAutoLayout() }} /></div>}
              {!showComposer && nodes.length === 2 && edges.length === 0 && <div className="empty-case"><span className="eyebrow">{t("No decisions on record")}</span><p>{t("Your future has no alibi.")}</p><button onClick={() => setShowComposer(true)}><Plus size={15} /> {t('Your decision')}</button><button onClick={loadTemplate} disabled={running}><FileText size={15} /> {t("Open an example case")}</button></div>}
            </div>
            <footer className="canvas-footer"><span><i className={running ? 'status-dot active' : 'status-dot'} />{running ? t("Consequences in progress") : runError ? t("Case interrupted") : runFinished ? t("Outcome on record") : t("Draft / not yet lived")}</span><span>{decisions} {t('decisions')} / {edges.length} {t('connections')}</span></footer>
          </section>
          <aside className={`case-panel ${showResults ? 'is-open' : ''}`} aria-label={t("Case file")}>
            <div className="panel-heading"><div><span className="eyebrow">{t("03 / The consequences")}</span><h2>{t("Case file")}</h2></div><button className="icon-button mobile-panel-button" aria-label={t("Close case file")} title={t("Close case file")} onClick={() => setShowResults(false)}><X size={17} /></button></div>
            <div className="resource-heading"><span className="eyebrow">{lifeState ? t("Resources remaining") : t("Resources on arrival")}</span>{lifeState && !lifeState.hidup && <span className="text-stamp-red">{t("Deceased")}</span>}</div>
            <dl className="resource-ledger">{STATS.map(({ key, label }) => <div key={key}><dt>{t(label)}</dt><dd>{key === 'uang' ? formatMoney(stats[key], language) : stats[key].toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}{key !== 'umur' && key !== 'uang' && <meter min={0} max={100} value={stats[key]} aria-label={t(label)} />}</dd></div>)}</dl>
            <div className="record-heading"><span className="eyebrow">{t("Record of events")}</span><span className="record-count">{String(results.length).padStart(2, '0')}</span></div>
            <div className="case-events" aria-live="polite" aria-busy={running}>
              <EventResponse />
              {results.length === 0 ? <div className="empty-record"><FileText size={30} strokeWidth={1} /><h3>{running ? t("Reality is deliberating.") : t("Nothing has happened. Yet.")}</h3><p>{running ? t("The first consequences are pending.") : t("All plans look reasonable before the consequences arrive.")}</p></div> : results.map((r, i) => <SegmentResult key={r.segmentId} result={r} index={i} />)}
              {running && <div className="running-note" role="status"><LoaderCircle size={14} className="animate-spin" /> {t("Recording consequences...")}</div>}
            </div>
            {chapterComplete && lifeState?.hidup && <div className="chapter-response"><DecisionComposer onAdded={() => { setShowResults(false); applyAutoLayout() }} /></div>}
            {runFinished && <button className="close-case-button" onClick={() => fetchSummary(kondisiAwal, lifeState)} disabled={summaryLoading}><FileText size={16} />{summaryLoading ? t("Filing...") : t("Close the case")}</button>}
          </aside>
        </div>
      </ReactFlowProvider>
      {summary && lifeState && <LifeCard summary={summary} kondisiAwal={initialConditions ?? kondisiAwal} stateAkhir={lifeState} onClose={closeSummary} />}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
    </main>
  )
}
