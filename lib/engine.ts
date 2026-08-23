import type { Cabang, LifeState, LifeStateBaru } from './schema'

const MAX_KEJADIAN_PER_SEGMEN = 2

/** kepadatan = total intensity semua node di segmen / lama segmen dalam tahun */
export function hitungKepadatan(cabang: Cabang[], lamaSegmenTahun: number): number {
  const totalIntensity = cabang
    .flatMap((c) => c.nodes)
    .reduce((sum, n) => sum + n.intensity, 0)
  if (lamaSegmenTahun <= 0) return totalIntensity > 0 ? Infinity : 0
  return totalIntensity / lamaSegmenTahun
}

/** stateBaru dari LLM nggak bawa ledger — ledger cuma dikelola lewat appendLedger. */
export function applyDelta(state: LifeState, stateBaru: LifeStateBaru): LifeState {
  return { ...stateBaru, ledger: state.ledger }
}

export function appendLedger(state: LifeState, kejadian: string[]): LifeState {
  const dipotong = kejadian.slice(0, MAX_KEJADIAN_PER_SEGMEN)
  return { ...state, ledger: [...state.ledger, ...dipotong] }
}
