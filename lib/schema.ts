import { z } from 'zod'

export const LANES = ['karir', 'relasi', 'kesehatan', 'chaos'] as const
export type Lane = (typeof LANES)[number]

export const NODE_KINDS = ['start', 'aksi', 'merge', 'end'] as const
export type NodeKind = (typeof NODE_KINDS)[number]

export const STATUS_NODE = ['sukses', 'separuh', 'gagal'] as const
export type StatusNode = (typeof STATUS_NODE)[number]

export const LifeNodeSchema = z
  .object({
    id: z.string(),
    kind: z.enum(NODE_KINDS),
    x: z.number(),
    y: z.number(),
    lane: z.enum(LANES).optional(),
    label: z.string().max(60).optional(),
    durasi: z.number().min(1).max(15).optional(),
    intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    note: z.string().max(140).optional(),
  })
  .superRefine((node, ctx) => {
    if (node.kind === 'aksi') {
      if (!node.lane) ctx.addIssue({ code: 'custom', message: "node 'aksi' wajib punya lane" })
      if (!node.label) ctx.addIssue({ code: 'custom', message: "node 'aksi' wajib punya label" })
      if (node.durasi === undefined)
        ctx.addIssue({ code: 'custom', message: "node 'aksi' wajib punya durasi" })
    }
  })
export type LifeNode = z.infer<typeof LifeNodeSchema>

// Kondisi awal (umur, uang, latar belakang) — input dari node start, terpisah
// dari LifeNode karena bukan bagian graf yang dikirim ke LLM per segmen.
export const KondisiAwalSchema = z.object({
  umur: z.number().min(0).max(100),
  uang: z.number(),
  latarBelakang: z.string().max(140),
})
export type KondisiAwal = z.infer<typeof KondisiAwalSchema>

export const EdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
})
export type Edge = z.infer<typeof EdgeSchema>

export const LifeStateSchema = z.object({
  umur: z.number(),
  uang: z.number(),
  energi: z.number().min(0).max(100),
  reputasi: z.number().min(0).max(100),
  kebahagiaan: z.number().min(0).max(100),
  skill: z.array(z.string()),
  relasi: z.array(
    z.object({ nama: z.string(), hubungan: z.string(), status: z.string() })
  ),
  ledger: z.array(z.string()),
  hidup: z.boolean(),
})
export type LifeState = z.infer<typeof LifeStateSchema>

// State yang dikirim balik LLM tidak bawa ledger — app yang kelola ledger.
export const LifeStateBaruSchema = LifeStateSchema.omit({ ledger: true })
export type LifeStateBaru = z.infer<typeof LifeStateBaruSchema>

// --- Kontrak LLM: request per segmen ---

export const CabangSchema = z.object({
  lane: z.enum(LANES),
  gapTahun: z.number().min(0),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      durasi: z.number(),
      intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    })
  ),
})
export type Cabang = z.infer<typeof CabangSchema>

export const SegmentRequestSchema = z.object({
  segmen: z.object({
    id: z.string(),
    umurMulai: z.number(),
    umurSelesai: z.number(),
  }),
  state: LifeStateSchema,
  cabang: z.array(CabangSchema),
  kepadatan: z.number(),
})
export type SegmentRequest = z.infer<typeof SegmentRequestSchema>

// --- Kontrak LLM: response per segmen ---

export const SegmentResponseSchema = z.object({
  narasiSegmen: z.string(),
  perNode: z.array(
    z.object({
      nodeId: z.string(),
      status: z.enum(STATUS_NODE),
      teks: z.string(),
      alasan: z.string().optional(),
    })
  ),
  narasiGap: z.array(z.object({ lane: z.enum(LANES), teks: z.string() })),
  stateBaru: LifeStateBaruSchema,
  kejadianPenting: z.array(z.string()).max(2),
})
export type SegmentResponse = z.infer<typeof SegmentResponseSchema>

// --- Graf mentah yang dikirim client -> server ---

export const GraphSchema = z.object({
  nodes: z.array(LifeNodeSchema),
  edges: z.array(EdgeSchema),
})
export type Graph = z.infer<typeof GraphSchema>

// --- Hasil validasi graf ---

export interface ValidationIssue {
  nodeId: string
  pesan: string
}

// --- Kontrak LLM: ringkasan akhir (CLAUDE.md §9) ---

export const RingkasanRequestSchema = z.object({
  kondisiAwal: KondisiAwalSchema,
  stateAkhir: LifeStateSchema,
})
export type RingkasanRequest = z.infer<typeof RingkasanRequestSchema>

export const RingkasanResponseSchema = z.object({
  judulHidup: z.string(),
  epitaf: z.string(),
  momenPenentu: z.array(z.string()).length(3),
  skorPerLane: z.array(z.object({ lane: z.enum(LANES), label: z.string() })).length(4),
})
export type RingkasanResponse = z.infer<typeof RingkasanResponseSchema>
