import type { Graph, KondisiAwal, Lane } from './schema'
import type { Language } from './locale'

const EXAMPLES = [
  { age: 23, funds: 8000000, background: ['A graduate with savings and too many plans.', 'Lulusan baru dengan tabungan dan terlalu banyak rencana.'], steps: [
    ['karir', 'Take an office job', 'Kerja kantoran', 2], ['relasi', 'Start dating', 'Mulai pacaran', 1], ['chaos', 'Open a weekend coffee stall', 'Buka kedai kopi akhir pekan', 1],
    ['karir', 'Rent a shop for the coffee business', 'Sewa ruko untuk usaha kopi', 2], ['karir', 'Keep the stall and build savings', 'Pertahankan kedai dan tambah tabungan', 1], ['relasi', 'Plan a home together', 'Rencanakan rumah bersama pasangan', 1],
  ] },
  { age: 31, funds: 25000000, background: ['Tired of the city, considering a quieter life.', 'Lelah di kota, ingin hidup lebih tenang.'], steps: [
    ['karir', 'Open a bookshop in Bali', 'Buka toko buku di Bali', 2], ['kesehatan', 'Learn to surf', 'Belajar selancar', 0.5], ['relasi', 'Start a neighborhood reading club', 'Buat klub baca tetangga', 1],
    ['karir', 'Expand into a community library', 'Kembangkan perpustakaan komunitas', 2], ['karir', 'Keep the bookshop small', 'Pertahankan toko buku kecil', 1], ['relasi', 'Host a local book festival', 'Adakan festival buku lokal', 0.5],
  ] },
  { age: 45, funds: 12000000, background: ['The children moved out. The house is finally quiet.', 'Anak-anak sudah merantau. Rumah akhirnya sepi.'], steps: [
    ['kesehatan', 'Train for a half marathon', 'Latihan setengah maraton', 1], ['chaos', 'Learn stand-up comedy', 'Belajar stand-up comedy', 0.5], ['relasi', 'Reconnect with an old friend', 'Hubungi sahabat lama', 1],
    ['kesehatan', 'Join a coastal running club', 'Gabung komunitas lari pantai', 1], ['chaos', 'Perform at a neighborhood open mic', 'Tampil di panggung komedi kampung', 0.5], ['relasi', 'Organize a family reunion', 'Adakan reuni keluarga', 0.5],
  ] },
  { age: 27, funds: 3000000, background: ['Back at the family home after a failed startup.', 'Pulang ke rumah keluarga setelah startup gagal.'], steps: [
    ['karir', 'Freelance as a designer', 'Freelance sebagai desainer', 1], ['relasi', 'Help run the family food stall', 'Bantu warung keluarga', 1], ['chaos', 'Make a documentary about the neighborhood', 'Buat dokumenter tentang kampung', 2],
    ['karir', 'Build a small film studio', 'Bangun studio film kecil', 2], ['karir', 'Take steady design contracts', 'Ambil kontrak desain tetap', 1], ['relasi', 'Train neighborhood teenagers', 'Latih remaja di kampung', 1],
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
    { id: 'pause', kind: 'tunggu', durasi: 0.5, x: 0, y: 0 },
    ...(index === 2 ? [] : [{ id: 'choice', kind: 'if' as const, x: 0, y: 0 }]),
    ...(index === 1 || index === 2 ? [{ id: 'surprise', kind: 'event' as const, x: 0, y: 0 }] : []),
    { id: 'end', kind: 'end', x: 0, y: 0 },
  ]
  const pairs = [['start', 'example-0'], ['start', 'example-1'], ['example-0', 'example-2'], ['example-1', 'example-2'], ['example-2', 'pause'],
    ...(index === 2 ? [['pause', 'example-3'], ['pause', 'example-4']] : [['pause', 'choice'], ['choice', 'example-3'], ['choice', 'example-4']]),
    ['example-3', 'example-5'], ['example-4', 'example-5'], ...(index === 1 || index === 2 ? [['example-5', 'surprise'], ['surprise', 'end']] : [['example-5', 'end']])]
  const edges = pairs.map(([from, to], i) => ({ id: `edge-${i}`, from, to, ...(from === 'choice' ? { label: language === 'id' ? (to === 'example-3' ? 'Jika uang dan energi mendukung' : 'Jika perlu menjaga kestabilan') : (to === 'example-3' ? 'If funds and energy allow' : 'If stability matters more') } : {}) }))
  return { index, graph: { nodes, edges }, kondisiAwal: { umur: example.age, uang: example.funds, latarBelakang: example.background[textIndex] } }
}
