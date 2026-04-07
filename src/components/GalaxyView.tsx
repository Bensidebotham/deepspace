'use client'

import { useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { GraphData, GraphNode } from '@/types/graph'

// react-force-graph-3d uses Three.js which requires client-side only
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false })

const CLUSTER_COLORS: Record<string, string> = {
  components: '#4299e1',
  pages: '#48bb78',
  app: '#48bb78',
  api: '#ed8936',
  lib: '#9f7aea',
  utils: '#9f7aea',
  hooks: '#f6ad55',
  types: '#fc8181',
  styles: '#68d391',
  src: '#76e4f7',
  root: '#a0aec0',
}

function getNodeColor(node: GraphNode): string {
  return CLUSTER_COLORS[node.clusterGroup] ?? '#718096'
}

function getNodeSize(node: GraphNode): number {
  // Scale between 1 and 8 based on importanceScore
  return 1 + node.importanceScore * 7
}

interface Props {
  graphData: GraphData
  onNodeClick: (node: GraphNode) => void
  highlightNodeId?: string
}

export default function GalaxyView({ graphData, onNodeClick, highlightNodeId }: Props) {
  const fgRef = useRef<any>(null)

  // Fly camera to highlighted node
  useEffect(() => {
    if (!highlightNodeId || !fgRef.current) return
    const node = graphData.nodes.find(n => n.id === highlightNodeId)
    if (!node) return
    fgRef.current.cameraPosition(
      { x: (node as any).x ?? 0, y: (node as any).y ?? 0, z: ((node as any).z ?? 0) + 100 },
      { x: (node as any).x ?? 0, y: (node as any).y ?? 0, z: (node as any).z ?? 0 },
      1000
    )
  }, [highlightNodeId, graphData.nodes])

  const handleNodeClick = useCallback(
    (node: object) => onNodeClick(node as GraphNode),
    [onNodeClick]
  )

  const forceData = {
    nodes: graphData.nodes.map(n => ({ ...n })),
    links: graphData.edges.map(e => ({ source: e.source, target: e.target })),
  }

  return (
    <div className="w-full h-full">
      <ForceGraph3D
        ref={fgRef}
        graphData={forceData}
        backgroundColor="#000000"
        nodeLabel={(node: any) => node.path}
        nodeColor={(node: any) => getNodeColor(node as GraphNode)}
        nodeVal={(node: any) => getNodeSize(node as GraphNode)}
        linkColor={() => 'rgba(255,255,255,0.08)'}
        linkWidth={0.5}
        onNodeClick={handleNodeClick}
        nodeOpacity={0.9}
      />
    </div>
  )
}
