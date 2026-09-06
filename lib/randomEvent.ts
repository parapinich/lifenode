import { RandomEventSchema, type LifeState } from './schema'
import { useRunStore } from './runStore'
import { useGraphStore } from './store'
import { translate, useLocaleStore } from './locale'

export const EVENT_CHANCE = 0.75
export const EVENT_COOLDOWN_YEARS = 2
export function eventOccurs(roll: number, age: number, lastAge: number | null) {
  return roll < EVENT_CHANCE && (lastAge === null || age - lastAge >= EVENT_COOLDOWN_YEARS)
}

export async function prepareEvent(id: string): Promise<void> {
  const run = useRunStore.getState()
  if (!run.lifeState || run.nextSyncId !== id) return
  const existing = run.events[id]
  if (existing?.data || existing?.skipped || existing?.choice !== undefined) return
  const roll = existing?.roll ?? Math.random()
  const skipped = !eventOccurs(roll, run.lifeState.umur, run.lastEventAge)
  useRunStore.setState((s) => ({ events: { ...s.events, [id]: { roll, skipped } } }))
  if (skipped) return
  const { nodes, edges, kondisiAwal } = useGraphStore.getState()
  try {
    const response = await fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: { nodes, edges }, kondisiAwal, state: run.lifeState, choices: run.selectedBranches, eventNodeId: id, seed: roll, language: useLocaleStore.getState().language }) })
    if (!response.ok) throw new Error('Event request failed')
    const data = RandomEventSchema.parse(await response.json())
    useRunStore.setState((s) => ({ events: { ...s.events, [id]: { roll, data } }, lastEventAge: run.lifeState!.umur }))
  } catch {
    useRunStore.setState((s) => ({ events: { ...s.events, [id]: { roll, error: true } } }))
  }
}

export function respondToEvent(id: string, choice: number | 'skip'): boolean {
  const run = useRunStore.getState()
  const record = run.events[id]
  if (run.running || run.summaryLoading || run.nextSyncId !== id || !run.lifeState?.hidup || !record || record.skipped || record.choice !== undefined) return false
  if (choice === 'skip') {
    if (!record.error) return false
    useRunStore.setState((s) => ({ events: { ...s.events, [id]: { ...record, skipped: true, error: false } } }))
    return true
  }
  const option = record.data?.options[choice]
  if (!option || !Number.isInteger(choice)) return false
  const state = run.lifeState
  const clamp = (value: number) => Math.max(0, Math.min(100, value))
  const relationships = new Map(state.relasi.map((r) => [r.nama, r]))
  for (const relationship of option.relasi) relationships.set(relationship.nama, relationship)
  const next: LifeState = { ...state, uang: state.uang + option.uang, energi: clamp(state.energi + option.energi), reputasi: clamp(state.reputasi + option.reputasi), kebahagiaan: clamp(state.kebahagiaan + option.kebahagiaan), skill: [...new Set([...state.skill, ...option.skill])], relasi: [...relationships.values()], ledger: [...state.ledger, `${record.data!.title}: ${option.label}. ${option.consequence}`] }
  useRunStore.setState((s) => ({
    lifeState: next,
    events: { ...s.events, [id]: { ...record, choice } },
    nodeStatus: { ...s.nodeStatus, [id]: 'sukses' },
    results: [...s.results, { segmentId: `event:${id}`, narasiSegmen: record.data!.story, narasiGap: [], perNode: [{ nodeId: id, status: 'sukses', teks: option.consequence, alasan: `${translate(useLocaleStore.getState().language, 'Response recorded')}: ${option.label}` }] }],
  }))
  return true
}
