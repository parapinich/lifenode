import { translate, useLocaleStore } from './locale'

// The routes already say exactly what broke — the job here is to stop throwing
// that away. `stage` names which call failed; `retryAfter` rides along so the
// UI can tell a rate limit (wait it out) from a real fault (fix something).
export async function post(stage: string, url: string, body: unknown): Promise<unknown> {
  const language = useLocaleStore.getState().language
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(`${translate(language, stage)}: ${json.error ?? res.status}`), { retryAfter: json.retryAfter })
  return json
}

export function retryUntilFrom(e: unknown): number | null {
  const seconds = (e as { retryAfter?: unknown })?.retryAfter
  return typeof seconds === 'number' && seconds > 0 ? Date.now() + seconds * 1000 : null
}
