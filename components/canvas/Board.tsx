'use client'

import '@xyflow/react/dist/style.css'
import { useLocaleStore } from '@/lib/locale'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
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
import { TungguNode } from './nodes/TungguNode'
import { MergeNode } from './nodes/MergeNode'
import { IfNode } from './nodes/IfNode'
import { EndNode } from './nodes/EndNode'
import { DeletableEdge } from './edges/DeletableEdge'
import type { LifeFlowNodeData } from './nodes/shared'
import type { PaletteDragPayload } from './NodePalette'
import type { Lane } from '@/lib/schema'

const nodeTypes = {
  start: StartNode,
  aksi: AksiNode,
  tunggu: TungguNode,
  merge: MergeNode,
  if: IfNode,
  end: EndNode,
}
const edgeTypes = { deletable: DeletableEdge }

export function Board() {
  const language = useLocaleStore((s) => s.language)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const kondisiAwal = useGraphStore((s) => s.kondisiAwal)
  const moveNode = useGraphStore((s) => s.moveNode)
  const beginNodeDrag = useGraphStore((s) => s.beginNodeDrag)
  const addEdgeToStore = useGraphStore((s) => s.addEdge)
  const addAksiNode = useGraphStore((s) => s.addAksiNode)
  const addTungguNode = useGraphStore((s) => s.addTungguNode)
  const addIfNode = useGraphStore((s) => s.addIfNode)
  const addMergeNode = useGraphStore((s) => s.addMergeNode)
  const removeElements = useGraphStore((s) => s.removeElements)
  const lockedNodeIds = useRunStore((s) => s.lockedNodeIds)
  const nodeStatus = useRunStore((s) => s.nodeStatus)
  const running = useRunStore((s) => s.running)
  const layoutVersion = useGraphStore((s) => s.layoutVersion)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const boardRef = useRef<HTMLDivElement>(null)
  const [touchMode, setTouchMode] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const update = () => setTouchMode(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    let previousWidth: number | undefined
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      if (previousWidth !== undefined && width !== previousWidth) {
        void fitView({ padding: 0.2, maxZoom: 1 })
      }
      previousWidth = width
    })
    if (boardRef.current) observer.observe(boardRef.current)
    return () => observer.disconnect()
  }, [fitView])

  useEffect(() => {
    if (layoutVersion === 0) return
    const id = requestAnimationFrame(() => fitView({ duration: 300, padding: 0.15 }))
    return () => cancelAnimationFrame(id)
  }, [layoutVersion, fitView])

  const issues = useMemo(() => validateGraph({ nodes, edges }, language), [nodes, edges, language])
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
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({})

  const rfNodes: Node<LifeFlowNodeData>[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: n.kind,
        position: { x: n.x, y: n.y },
        measured: measured[n.id],
        selected: selectedNodeIds.has(n.id),
        deletable: n.kind !== 'start' && n.kind !== 'end' && !lockedNodeIds.includes(n.id),
        data: {
          ...n,
          umurMulai: timing?.[n.id]?.umurMulai,
          umurSelesai: timing?.[n.id]?.umurSelesai,
          issues: issuesByNode.get(n.id) ?? [],
          runStatus: nodeStatus[n.id],
        },
      })),
    [nodes, timing, issuesByNode, nodeStatus, selectedNodeIds, lockedNodeIds, measured]
  )

  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set())

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => {
        const toStatus = nodeStatus[e.to]
        const fromStatus = nodeStatus[e.from]
        const skipped = toStatus === 'skipped' || fromStatus === 'skipped'
        // Sync nodes (start/merge/end) never get their own runStatus — an edge
        // into one of them reads as "completed" once its source settled.
        const active = !skipped && toStatus === 'loading'
        const completed = !skipped && !active && (isTerminalStatus(toStatus) || isTerminalStatus(fromStatus))
        const isIfEdge = nodeById.get(e.from)?.kind === 'if'
        return {
          id: e.id,
          source: e.from,
          target: e.to,
          type: 'deletable',
          selected: selectedEdgeIds.has(e.id),
          animated: active,
          data: { completed, skipped, isIfEdge, conditionLabel: e.label },
        }
      }),
    [edges, selectedEdgeIds, nodeStatus, nodeById]
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
        } else if (change.type === 'dimensions' && change.dimensions) {
          const dimensions = change.dimensions
          setMeasured((prev) => prev[change.id]?.width === dimensions.width && prev[change.id]?.height === dimensions.height ? prev : { ...prev, [change.id]: dimensions })
        } else if (change.type === 'select') {
          setSelectedNodeIds((prev) => {
            const next = new Set(prev)
            if (change.selected) next.add(change.id)
            else next.delete(change.id)
            return next
          })
        }
      }
    },
    [moveNode]
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
      else if (payload.type === 'tunggu') addTungguNode(pos.x, pos.y)
      else if (payload.type === 'if') addIfNode(pos.x, pos.y)
      else addMergeNode(pos.x, pos.y)
    },
    [running, screenToFlowPosition, addAksiNode, addTungguNode, addIfNode, addMergeNode]
  )

  return (
    <div ref={boardRef} className="life-board" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <ReactFlow
        ariaLabelConfig={language === 'id' ? { 'controls.zoomIn.ariaLabel': 'Perbesar', 'controls.zoomOut.ariaLabel': 'Perkecil', 'controls.fitView.ariaLabel': 'Tampilkan seluruh rencana', 'controls.interactive.ariaLabel': 'Kunci atau buka interaksi' } : undefined}
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={beginNodeDrag}
        onSelectionDragStart={beginNodeDrag}
        onDelete={({ nodes, edges }) => removeElements(nodes.map((n) => n.id), edges.map((e) => e.id))}
        nodesConnectable={!running}
        panOnDrag={touchMode ? true : [1]}
        selectionOnDrag={!touchMode}
        autoPanOnSelection={false}
        selectionKeyCode={null}
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.15}
      >
        <Background variant={BackgroundVariant.Dots} color="#bec2bd" gap={22} size={1} bgColor="#e9ece7" />
        <Controls />
        {nodes.length > 8 && <MiniMap className="life-minimap" pannable zoomable ariaLabel={language === 'id' ? 'Peta hidup' : 'Life map'} nodeColor={(node) => ({ karir: '#588369', relasi: '#ae6984', kesehatan: '#548f9a', chaos: '#c39b40' })[node.data.lane as Lane] ?? '#7b8179'} />}
      </ReactFlow>
    </div>
  )
}
