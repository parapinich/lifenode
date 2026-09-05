import type { Graph, KondisiAwal, Lane } from './schema'
import type { Language } from './locale'

const EXAMPLES = [
  { age: 23, funds: 8000000, background: ['A graduate with savings and too many plans.', 'Lulusan baru dengan tabungan dan terlalu banyak rencana.'], steps: [
    ['karir', 'Take an office job', 'Kerja kantoran', 2], ['relasi', 'Start dating', 'Mulai pacaran', 1], ['chaos', 'Open a weekend coffee stall', 'Buka kedai kopi akhir pekan', 1],
  ] },
  { age: 31, funds: 25000000, background: ['Tired of the city, considering a quieter life.', 'Lelah di kota, ingin hidup lebih tenang.'], steps: [
    ['karir', 'Open a bookshop in Bali', 'Buka toko buku di Bali', 2], ['kesehatan', 'Learn to surf', 'Belajar selancar', 0.5], ['relasi', 'Start a neighborhood reading club', 'Buat klub baca tetangga', 1],
  ] },
  { age: 45, funds: 12000000, background: ['The children moved out. The house is finally quiet.', 'Anak-anak sudah merantau. Rumah akhirnya sepi.'], steps: [
    ['kesehatan', 'Train for a half marathon', 'Latihan setengah maraton', 1], ['chaos', 'Learn stand-up comedy', 'Belajar stand-up comedy', 0.5], ['relasi', 'Reconnect with an old friend', 'Hubungi sahabat lama', 1],
  ] },
  { age: 27, funds: 3000000, background: ['Back at the family home after a failed startup.', 'Pulang ke rumah keluarga setelah startup gagal.'], steps: [
    ['karir', 'Freelance as a designer', 'Freelance sebagai desainer', 1], ['relasi', 'Help run the family food stall', 'Bantu warung keluarga', 1], ['chaos', 'Make a documentary about the neighborhood', 'Buat dokumenter tentang kampung', 2],
  ] },
] as const

export function nextExample(previous: number, language: Language, random = Math.random()): { index: number; graph: Graph; kondisiAwal: KondisiAwal } {
  const options = EXAMPLES.map((_, index) => index).filter((index) => index !== previous)
  const index = options[Math.min(options.length - 1, Math.floor(Math.max(0, random) * options.length))]
  const example = EXAMPLES[index]
  const textIndex = language === 'id' ? 1 : 0
  const nodes: Graph['nodes'] = [
    { id: 'start', kind: 'start', x: 0, y: 0 },
    ...example.steps.map(([lane, en, id, durasi], i) => ({ id: `example-${i}`, kind: 'aksi' as const, lane: lane as Lane, label: language === 'id' ? id : en, durasi, intensity: 1 as const, x: 0, y: 0 })),
    { id: 'end', kind: 'end', x: 0, y: 0 },
  ]
  const edges = example.steps.flatMap((_, i) => [
    { id: `in-${i}`, from: 'start', to: `example-${i}` }, { id: `out-${i}`, from: `example-${i}`, to: 'end' },
  ])
  return { index, graph: { nodes, edges }, kondisiAwal: { umur: example.age, uang: example.funds, latarBelakang: example.background[textIndex] } }
}
