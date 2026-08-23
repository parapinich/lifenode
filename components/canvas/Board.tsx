'use client'

import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { useGraphStore } from '@/lib/store'
import { useRunStore } from '@/lib/runStore'
import { computeGraph, validateGraph } from '@/lib/graph'
import { StartNode } from './nodes/StartNode'
import { AksiNode } from './nodes/AksiNode'
import { MergeNode } from './nodes/MergeNode'
import { EndNode } from './nodes/EndNode'
import { DeletableEdge } from './edges/DeletableEdge'
import type { LifeFlowNodeData } from './nodes/shared'
import type { PaletteDragPayload } from './NodePalette'

const nodeTypes = { start: StartNode, aksi: AksiNode, merge: MergeNode, end: EndNode }
const edgeTypes = { deletable: DeletableEdge }

export function Board() {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const kondisiAwal = useGraphStore((s) => s.kondisiAwal)
  const moveNode = useGraphStore((s) => s.moveNode)
  const beginNodeDrag = useGraphStore((s) => s.beginNodeDrag)
  const addEdgeToStore = useGraphStore((s) => s.addEdge)
  const addAksiNode = useGraphStore((s) => s.addAksiNode)
  const addMergeNode = useGraphStore((s) => s.addMergeNode)
  const nodeStatus = useRunStore((s) => s.nodeStatus)
  const layoutVersion = useGraphStore((s) => s.layoutVersion)
  const { screenToFlowPosition, fitView } = useReactFlow()

  useEffect(() => {
    if (layoutVersion === 0) return
    const id = requestAnimationFrame(() => fitView({ duration: 300, padding: 0.15 }))
    return () => cancelAnimationFrame(id)
  }, [layoutVersion, fitView])

  const issues = useMemo(() => validateGraph({ nodes, edges }), [nodes, edges])
  const issuesByNode = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const issue of issues) {
      if (!issue.nodeId) continue
      if (!map.has(issue.nodeId)) map.set(issue.nodeId, [])
      map.get(issue.nodeId)!.push(issue.pesan)
    }
    return map
  }, [issues])

  const timing = useMemo(() => {
    try {
      return computeGraph({ nodes, edges }, kondisiAwal.umur).timing
    } catch {
      return null
    }
  }, [nodes, edges, kondisiAwal.umur])

  const rfNodes: Node<LifeFlowNodeData>[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: n.kind,
        position: { x: n.x, y: n.y },
        data: {
          ...n,
          umurMulai: timing?.[n.id]?.umurMulai,
          umurSelesai: timing?.[n.id]?.umurSelesai,
          issues: issuesByNode.get(n.id) ?? [],
          runStatus: nodeStatus[n.id],
        },
      })),
    [nodes, timing, issuesByNode, nodeStatus]
  )

  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set())

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        type: 'deletable',
        selected: selectedEdgeIds.has(e.id),
      })),
    [edges, selectedEdgeIds]
  )

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const change of changes) {
      if (change.type === 'select') {
        setSelectedEdgeIds((prev) => {
          const next = new Set(prev)
          if (change.selected) next.add(change.id)
          else next.delete(change.id)
          return next
        })
      }
    }
  }, [])

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<LifeFlowNodeData>>[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveNode(change.id, change.position.x, change.position.y)
        }
      }
    },
    [moveNode]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) addEdgeToStore(connection.source, connection.target)
    },
    [addEdgeToStore]
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const raw = event.dataTransfer.getData('application/lifeflow-node')
      if (!raw) return
      const payload: PaletteDragPayload = JSON.parse(raw)
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      if (payload.type === 'aksi') addAksiNode(payload.lane, payload.label, pos.x, pos.y)
      else addMergeNode(pos.x, pos.y)
    },
    [screenToFlowPosition, addAksiNode, addMergeNode]
  )

  return (
    <div className="flex-1" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={beginNodeDrag}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} color="#a68e63" gap={22} size={1} bgColor="#d8c19c" />
        <Controls />
      </ReactFlow>
    </div>
  )
}
