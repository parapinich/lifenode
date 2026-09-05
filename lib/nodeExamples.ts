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

const BACKSTORY_ID = [
  'baru lulus kuliah, belum tahu mau melakukan apa',
  'bungsu dari empat bersaudara, yang lain sudah mapan',
  'baru putus, kembali tinggal bersama orang tua',
  'berhenti kuliah tahun kedua, lalu jadi freelancer',
  'mewarisi sedikit utang dan ego besar dari ayah',
  'anak perantau, orang pertama di keluarga yang kuliah',
  'resign spontan dari pekerjaan tetap tahun lalu',
  'masih hidup dari tabungan setelah startup diakuisisi',
]
export function randomBackstory(language: 'en' | 'id' = 'en'): string {
  const examples = language === 'id' ? BACKSTORY_ID : BACKSTORY_EXAMPLES
  return examples[Math.floor(Math.random() * examples.length)]
}
