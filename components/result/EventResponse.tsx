import { Dices, ArrowRight, RotateCcw } from 'lucide-react'
import { useRunStore, useCooldown } from '@/lib/runStore'
import { useGraphStore } from '@/lib/store'
import { useT } from '@/lib/locale'
import { respondToEvent } from '@/lib/randomEvent'
import { executeGraph } from '@/lib/runExecute'

export function EventResponse() {
  const t = useT()
  const run = useRunStore()
  const cooldown = useCooldown()
  const graph = useGraphStore()
  const id = run.nextSyncId
  if (!id || graph.nodes.find((n) => n.id === id)?.kind !== 'event') return null
  const event = run.events[id]
  if (event?.choice !== undefined) return null
  const proceed = () => void executeGraph(graph.nodes, graph.edges, graph.kondisiAwal)
  return <section className="event-response" aria-label={t('Random Event')} aria-busy={run.running}>
    <div className="flex items-center gap-2 text-lane-chaos"><Dices size={18} /><span className="eyebrow">{t('Random Event')}</span></div>
    {event?.data ? <><h3>{event.data.title}</h3><p>{event.data.story}</p><div role="group" aria-label={t('Choose a response')}>{event.data.options.map((option, index) => <button key={index} disabled={run.running} onClick={() => { if (respondToEvent(id, index)) proceed() }}><ArrowRight size={14} /><span>{option.label}</span></button>)}</div></> : event?.skipped ? <p>{t('No unexpected event this time.')}</p> : event?.error ? <><p role="alert">{event.error}</p><button disabled={run.running || cooldown > 0} onClick={proceed}><RotateCcw size={14} />{cooldown > 0 ? `${t('Try again in')} ${cooldown}s` : t('Try again')}</button><button disabled={run.running} onClick={() => { if (respondToEvent(id, 'skip')) proceed() }}><ArrowRight size={14} />{t('Continue without event')}</button></> : <p role="status">{t('Unfolding...')}</p>}
  </section>
}
