// Contoh latar belakang buat tombol Randomize di "Background note" (kondisiAwal.latarBelakang).
// Array literal, bukan LLM call — nggak perlu API buat random teks pendek kayak gini.
export const BACKSTORY_EXAMPLES: string[] = [
  'fresh out of college, no idea what to do next',
  'youngest of four, everyone else already has their life figured out',
  'just got dumped, moved back in with parents',
  'dropped out sophomore year, been freelancing since',
  'inherited a small debt and a big ego from dad',
  'immigrant kid, first in the family to go to college',
  'quit a stable job on a whim last year',
  'still living off savings from a startup that got acquired',
]

export function randomBackstory(): string {
  return BACKSTORY_EXAMPLES[Math.floor(Math.random() * BACKSTORY_EXAMPLES.length)]
}
