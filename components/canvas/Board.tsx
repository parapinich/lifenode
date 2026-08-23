'use client'

import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  SelectionMode,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { useGraphStore } from '@/lib/store'
import { useRunStore, isTerminalStatus } from '@/lib/runStore'
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
  const removeNode = useGraphStore((s) => s.removeNode)
  const nodeStatus = useRunStore((s) => s.nodeStatus)
  const running = useRunStore((s) => s.running)
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

  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())

  const rfNodes: Node<LifeFlowNodeData>[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: n.kind,
        position: { x: n.x, y: n.y },
        selected: selectedNodeIds.has(n.id),
        data: {
          ...n,
          umurMulai: timing?.[n.id]?.umurMulai,
          umurSelesai: timing?.[n.id]?.umurSelesai,
          issues: issuesByNode.get(n.id) ?? [],
          runStatus: nodeStatus[n.id],
        },
      })),
    [nodes, timing, issuesByNode, nodeStatus, selectedNodeIds]
  )

  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set())

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => {
        const toStatus = nodeStatus[e.to]
        const fromStatus = nodeStatus[e.from]
        // Sync nodes (start/merge/end) never get their own runStatus — an edge
        // into one of them reads as "completed" once its source settled.
        const active = toStatus === 'loading'
        const completed = !active && (isTerminalStatus(toStatus) || isTerminalStatus(fromStatus))
        return {
          id: e.id,
          source: e.from,
          target: e.to,
          type: 'deletable',
          selected: selectedEdgeIds.has(e.id),
          animated: active,
          data: { completed },
        }
      }),
    [edges, selectedEdgeIds, nodeStatus]
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
        } else if (change.type === 'select') {
          setSelectedNodeIds((prev) => {
            const next = new Set(prev)
            if (change.selected) next.add(change.id)
            else next.delete(change.id)
            return next
          })
        } else if (change.type === 'remove') {
          if (running) continue
          removeNode(change.id)
        }
      }
    },
    [moveNode, removeNode, running]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (running) return
      if (connection.source && connection.target) addEdgeToStore(connection.source, connection.target)
    },
    [running, addEdgeToStore]
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      if (running) return
      const raw = event.dataTransfer.getData('application/lifenode-node')
      if (!raw) return
      const payload: PaletteDragPayload = JSON.parse(raw)
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      if (payload.type === 'aksi') addAksiNode(payload.lane, payload.label, pos.x, pos.y)
      else addMergeNode(pos.x, pos.y)
    },
    [running, screenToFlowPosition, addAksiNode, addMergeNode]
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
        nodesConnectable={!running}
        panOnDrag={[1]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} color="#a68e63" gap={22} size={1} bgColor="#d8c19c" />
        <Controls />
      </ReactFlow>
    </div>
  )
}
