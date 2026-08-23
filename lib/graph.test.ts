import { describe, expect, it } from 'vitest'
import type { Edge, Graph, LifeNode } from './schema'
import { GraphCycleError, autoLayout, computeGraph, segmentCabang, topologicalSort, validateGraph } from './graph'

function node(partial: Partial<LifeNode> & { id: string; kind: LifeNode['kind'] }): LifeNode {
  return { x: 0, y: 0, ...partial }
}

function edge(id: string, from: string, to: string): Edge {
  return { id, from, to }
}

describe('graf linear', () => {
  const graph: Graph = {
    nodes: [
      node({ id: 'start', kind: 'start' }),
      node({ id: 'kuliah', kind: 'aksi', lane: 'karir', label: 'Kuliah', intensity: 2 }),
      node({ id: 'kuliah-wait', kind: 'tunggu', durasi: 4 }),
      node({ id: 'end', kind: 'end' }),
    ],
    edges: [edge('e1', 'start', 'kuliah'), edge('e2', 'kuliah', 'kuliah-wait'), edge('e3', 'kuliah-wait', 'end')],
  }

  it('lolos validasi', () => {
    expect(validateGraph(graph)).toEqual([])
  })

  it('aksi selalu instan, umur maju lewat node tunggu', () => {
    const { timing, segments } = computeGraph(graph, 18)
    expect(timing.start).toEqual({ umurMulai: 18, umurSelesai: 18 })
    expect(timing.kuliah).toEqual({ umurMulai: 18, umurSelesai: 18 })
    expect(timing['kuliah-wait']).toEqual({ umurMulai: 18, umurSelesai: 22 })
    expect(timing.end).toEqual({ umurMulai: 22, umurSelesai: 22 })
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ syncStartId: 'start', syncEndId: 'end', umurMulai: 18, umurSelesai: 22, nodeIds: ['kuliah'] })
  })
})

describe('graf bercabang dengan merge timpang', () => {
  const graph: Graph = {
    nodes: [
      node({ id: 'start', kind: 'start' }),
      node({ id: 'karir', kind: 'aksi', lane: 'karir', label: 'Buka warung', intensity: 3 }),
      node({ id: 'karir-wait', kind: 'tunggu', durasi: 9 }),
      node({ id: 'relasi', kind: 'aksi', lane: 'relasi', label: 'Nikah', intensity: 2 }),
      node({ id: 'relasi-wait', kind: 'tunggu', durasi: 3 }),
      node({ id: 'merge1', kind: 'merge' }),
      node({ id: 'end', kind: 'end' }),
    ],
    edges: [
      edge('e1', 'start', 'karir'),
      edge('e1w', 'karir', 'karir-wait'),
      edge('e2', 'start', 'relasi'),
      edge('e2w', 'relasi', 'relasi-wait'),
      edge('e3', 'karir-wait', 'merge1'),
      edge('e4', 'relasi-wait', 'merge1'),
      edge('e5', 'merge1', 'end'),
    ],
  }

  it('gapTahun dihitung dari selisih cabang terpanjang', () => {
    const { timing, gaps, segments } = computeGraph(graph, 20)
    expect(timing['karir-wait'].umurSelesai).toBe(29)
    expect(timing['relasi-wait'].umurSelesai).toBe(23)
    expect(timing.merge1.umurMulai).toBe(29)
    expect(gaps).toContainEqual({ mergeId: 'merge1', fromNodeId: 'relasi-wait', gapTahun: 6 })
    expect(gaps).toContainEqual({ mergeId: 'merge1', fromNodeId: 'karir-wait', gapTahun: 0 })

    expect(segments).toHaveLength(2)
    const seg1 = segments.find((s) => s.syncStartId === 'start')!
    expect(seg1.nodeIds.sort()).toEqual(['karir', 'relasi'])
    expect(seg1.umurMulai).toBe(20)
    expect(seg1.umurSelesai).toBe(29)
    const seg2 = segments.find((s) => s.syncStartId === 'merge1')!
    expect(seg2.syncEndId).toBe('end')
    expect(seg2.nodeIds).toEqual([])
  })

  it('segmentCabang ngelompokin per lane dan gapTahun ngikutin ujung rantai tunggu', () => {
    const { timing, segments } = computeGraph(graph, 20)
    const seg1 = segments.find((s) => s.syncStartId === 'start')!
    const cabang = segmentCabang(seg1, graph.nodes, graph.edges, timing)
    expect(cabang).toHaveLength(2)
    const karir = cabang.find((c) => c.lane === 'karir')!
    const relasi = cabang.find((c) => c.lane === 'relasi')!
    // karir adalah cabang terpanjang (via karir-wait, 9 tahun) — gap 0.
    expect(karir.gapTahun).toBe(0)
    // relasi cuma 3 tahun (relasi-wait) — nganggur 6 tahun nunggu karir kelar.
    expect(relasi.gapTahun).toBe(6)
    expect(karir.nodes).toEqual([{ id: 'karir', label: 'Buka warung', durasi: 0, intensity: 3, note: undefined }])
  })

  it('autoLayout nempatin node per lane band dan x ngikutin umur', () => {
    const positions = autoLayout(graph, 20)
    expect(positions.karir.x).toBe(positions.relasi.x)
    expect(positions.karir.x).toBeGreaterThan(positions.start.x)
    expect(positions.karir.y).not.toBe(positions.relasi.y)
    expect(positions.merge1.x).toBeGreaterThan(positions['karir-wait'].x)
    expect(positions.end.x).toBeGreaterThan(positions.merge1.x)
  })
})

describe('node tunggu', () => {
  it('cabang tanpa node tunggu sama sekali tetep instan (durasi 0)', () => {
    const graph: Graph = {
      nodes: [
        node({ id: 'start', kind: 'start' }),
        node({ id: 'putus', kind: 'aksi', lane: 'relasi', label: 'Putus', intensity: 3 }),
        node({ id: 'end', kind: 'end' }),
      ],
      edges: [edge('e1', 'start', 'putus'), edge('e2', 'putus', 'end')],
    }
    const { timing } = computeGraph(graph, 25)
    expect(timing.putus).toEqual({ umurMulai: 25, umurSelesai: 25 })
    expect(timing.end).toEqual({ umurMulai: 25, umurSelesai: 25 })
  })

  it('menolak tunggu tanpa durasi atau dengan kabel masuk/keluar yang salah', () => {
    const graph: Graph = {
      nodes: [
        node({ id: 'start', kind: 'start' }),
        node({ id: 'w', kind: 'tunggu' }),
        node({ id: 'end', kind: 'end' }),
      ],
      edges: [edge('e1', 'start', 'w'), edge('e2', 'w', 'end')],
    }
    const issues = validateGraph(graph)
    expect(issues.some((i) => i.nodeId === 'w' && i.pesan.includes('duration'))).toBe(true)
  })
})

describe('validasi graf', () => {
  it('menolak siklus', () => {
    const graph: Graph = {
      nodes: [
        node({ id: 'a', kind: 'aksi', lane: 'chaos', label: 'A', intensity: 1 }),
        node({ id: 'b', kind: 'aksi', lane: 'chaos', label: 'B', intensity: 1 }),
      ],
      edges: [edge('e1', 'a', 'b'), edge('e2', 'b', 'a')],
    }
    expect(() => topologicalSort(graph.nodes, graph.edges)).toThrow(GraphCycleError)
    expect(validateGraph(graph)).toContainEqual({ nodeId: '', pesan: 'Graph contains a cycle' })
  })

  it('menolak merge dengan kurang dari 2 kabel masuk', () => {
    const graph: Graph = {
      nodes: [
        node({ id: 'start', kind: 'start' }),
        node({ id: 'merge1', kind: 'merge' }),
        node({ id: 'end', kind: 'end' }),
      ],
      edges: [edge('e1', 'start', 'merge1'), edge('e2', 'merge1', 'end')],
    }
    const issues = validateGraph(graph)
    expect(issues.some((i) => i.nodeId === 'merge1')).toBe(true)
  })

  it('menandai node yang nggak nyambung ke start', () => {
    const graph: Graph = {
      nodes: [
        node({ id: 'start', kind: 'start' }),
        node({ id: 'end', kind: 'end' }),
        node({ id: 'nikah', kind: 'aksi', lane: 'relasi', label: 'Nikah', intensity: 1 }),
      ],
      edges: [edge('e1', 'start', 'end')],
    }
    const issues = validateGraph(graph)
    expect(issues).toContainEqual({ nodeId: 'nikah', pesan: "Node 'Nikah' isn't connected to start" })
  })

  it('menolak lebih dari 5 merge', () => {
    const nodes: LifeNode[] = [node({ id: 'start', kind: 'start' })]
    const edges: Edge[] = []
    let prev = 'start'
    for (let i = 0; i < 6; i++) {
      const a = `a${i}`
      const m = `m${i}`
      nodes.push(node({ id: a, kind: 'aksi', lane: 'chaos', label: a, intensity: 1 }))
      nodes.push(node({ id: m, kind: 'merge' }))
      edges.push(edge(`ea${i}`, prev, a), edge(`eb${i}`, a, m), edge(`ec${i}`, prev, m))
      prev = m
    }
    nodes.push(node({ id: 'end', kind: 'end' }))
    edges.push(edge('eend', prev, 'end'))
    const issues = validateGraph({ nodes, edges })
    expect(issues.some((i) => i.pesan.includes('Maximum 5 Merge'))).toBe(true)
  })
})
