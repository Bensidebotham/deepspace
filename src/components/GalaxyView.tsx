'use client'

import { useRef, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import type { GraphData, GraphNode } from '@/types/graph'

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false })

// Maximally distinct palette — each cluster gets a clearly different hue
const CLUSTER_COLORS: Record<string, string> = {
  components: '#38bdf8', // sky blue
  pages:      '#4ade80', // vivid green
  app:        '#4ade80', // vivid green
  api:        '#fb923c', // bold orange
  lib:        '#c084fc', // purple
  utils:      '#22d3ee', // cyan
  hooks:      '#fde047', // bright yellow
  types:      '#fb7185', // hot pink
  styles:     '#a3e635', // lime
  store:      '#818cf8', // indigo
  context:    '#818cf8', // indigo
  actions:    '#f472b6', // pink
  services:   '#f97316', // orange
  middleware: '#e879f9', // fuchsia
  config:     '#94a3b8', // slate
  root:       '#94a3b8', // slate
}

// Fallback palette for clusters not in the map above
const FALLBACK_COLORS = [
  '#2dd4bf', '#60a5fa', '#f87171', '#a78bfa',
  '#34d399', '#fbbf24', '#e879f9', '#6ee7b7',
]

function clusterColor(group: string): string {
  if (CLUSTER_COLORS[group]) return CLUSTER_COLORS[group]
  // Deterministic fallback based on cluster name
  let hash = 0
  for (let i = 0; i < group.length; i++) hash = (hash * 31 + group.charCodeAt(i)) >>> 0
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

function nodeRadius(node: GraphNode): number {
  const importance = node.importanceScore * 8
  const lines      = Math.min(node.lineCount / 200, 1) * 3
  return 2 + importance + lines  // range: 2–13
}

interface Props {
  graphData: GraphData
  onNodeClick: (node: GraphNode) => void
  highlightNodeId?: string
}

export default function GalaxyView({ graphData, onNodeClick, highlightNodeId }: Props) {
  const fgRef        = useRef<any>(null)
  const highlightRef = useRef<string | undefined>(highlightNodeId)

  const colorById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const n of graphData.nodes) map[n.id] = clusterColor(n.clusterGroup)
    return map
  }, [graphData.nodes])

  useEffect(() => {
    highlightRef.current = highlightNodeId
    fgRef.current?.refresh()
  }, [highlightNodeId])

  useEffect(() => {
    if (!highlightNodeId || !fgRef.current) return
    const node = graphData.nodes.find(n => n.id === highlightNodeId)
    if (!node) return
    const x = (node as any).x ?? 0
    const y = (node as any).y ?? 0
    const z = (node as any).z ?? 0
    fgRef.current.cameraPosition(
      { x, y, z: z + 120 },
      { x, y, z },
      1000
    )
  }, [highlightNodeId, graphData.nodes])

  const buildNodeObject = useCallback((nodeData: object) => {
    const node        = nodeData as GraphNode
    const highlighted = highlightRef.current === node.id
    const color       = clusterColor(node.clusterGroup)
    const radius      = nodeRadius(node)
    const threeColor  = new THREE.Color(color)
    const group       = new THREE.Group()

    // Core sphere
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 20),
      new THREE.MeshPhongMaterial({
        color: threeColor,
        emissive: threeColor,
        emissiveIntensity: highlighted ? 1.0 : 0.5,
        transparent: true,
        opacity: highlighted ? 1.0 : 0.9,
        shininess: 100,
      })
    ))

    // Outer glow — all nodes get a subtle halo, highlighted get a big one
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(radius * (highlighted ? 2.0 : 1.5), 20, 20),
      new THREE.MeshPhongMaterial({
        color: threeColor,
        emissive: threeColor,
        emissiveIntensity: highlighted ? 0.6 : 0.15,
        transparent: true,
        opacity: highlighted ? 0.2 : 0.06,
        side: THREE.BackSide,
      })
    ))

    // Filename label — always visible
    const filename   = node.path.split('/').pop() ?? node.path
    const textHeight = Math.max(2, radius * 1.0)
    const label      = new SpriteText(filename)
    label.color           = highlighted ? '#ffffff' : 'rgba(255,255,255,0.75)'
    label.textHeight      = textHeight
    label.fontFace        = 'ui-monospace, SF Mono, Consolas, monospace'
    label.backgroundColor = 'rgba(0,0,0,0)'
    label.strokeWidth     = 0
    label.position.set(0, radius + textHeight + 1, 0)
    group.add(label)

    return group
  }, [])

  const handleNodeClick = useCallback(
    (node: object) => onNodeClick(node as GraphNode),
    [onNodeClick]
  )

  const linkColor = useCallback(
    (link: any) => {
      const id = typeof link.source === 'object' ? link.source.id : link.source
      return (colorById[id] ?? '#94a3b8') + 'cc'  // ~80% opacity — clearly visible
    },
    [colorById]
  )

  const particleColor = useCallback(
    (link: any) => {
      const id = typeof link.source === 'object' ? link.source.id : link.source
      return colorById[id] ?? '#ffffff'
    },
    [colorById]
  )

  const forceData = useMemo(() => ({
    nodes: graphData.nodes.map(n => ({ ...n })),
    links: graphData.edges.map(e => ({ source: e.source, target: e.target })),
  }), [graphData])

  return (
    <div className="w-full h-full">
      <ForceGraph3D
        ref={fgRef}
        graphData={forceData}
        backgroundColor="#000005"
        nodeThreeObject={buildNodeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={(node: any) => node.path}
        linkColor={linkColor}
        linkWidth={1.5}
        linkDirectionalParticles={3}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={particleColor}
        onNodeClick={handleNodeClick}
      />
    </div>
  )
}
