import { describe, expect, it } from 'vitest'
import type { Cabang, LifeState, LifeStateBaru } from './schema'
import { appendLedger, applyDelta, hitungKepadatan } from './engine'

function cabang(lane: Cabang['lane'], intensity: 1 | 2 | 3, count = 1): Cabang {
  return {
    lane,
    gapTahun: 0,
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `${lane}${i}`,
      label: lane,
      durasi: 1,
      intensity,
    })),
  }
}

const stateAwal: LifeState = {
  umur: 20,
  uang: 1_000_000,
  energi: 80,
  reputasi: 50,
  kebahagiaan: 60,
  skill: [],
  relasi: [],
  ledger: ['dulu pernah dagang mie ayam'],
  hidup: true,
}

describe('hitungKepadatan', () => {
  it('longgar kalau intensity rendah dan segmen panjang', () => {
    expect(hitungKepadatan([cabang('karir', 1)], 4)).toBe(0.25)
  })

  it('overload kalau intensity tinggi dan segmen pendek', () => {
    expect(hitungKepadatan([cabang('karir', 3), cabang('relasi', 3)], 2)).toBe(3)
  })
})

describe('applyDelta', () => {
  it('pakai stateBaru tapi ledger lama dipertahankan', () => {
    const stateBaru: LifeStateBaru = {
      umur: 25,
      uang: 500_000,
      energi: 40,
      reputasi: 55,
      kebahagiaan: 45,
      skill: ['ngutang'],
      relasi: [],
      hidup: true,
    }
    const hasil = applyDelta(stateAwal, stateBaru)
    expect(hasil.umur).toBe(25)
    expect(hasil.ledger).toBe(stateAwal.ledger)
  })
})

describe('appendLedger', () => {
  it('nambah kejadian baru tanpa buang yang lama', () => {
    const hasil = appendLedger(stateAwal, ['warung kebakaran'])
    expect(hasil.ledger).toEqual(['dulu pernah dagang mie ayam', 'warung kebakaran'])
  })

  it('motong ke maksimal 2 kejadian per segmen', () => {
    const hasil = appendLedger(stateAwal, ['a', 'b', 'c'])
    expect(hasil.ledger).toEqual(['dulu pernah dagang mie ayam', 'a', 'b'])
  })
})
