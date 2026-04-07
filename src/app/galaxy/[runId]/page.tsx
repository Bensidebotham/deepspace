'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { GraphData, GraphNode } from '@/types/graph'
import FilePanel from '@/components/FilePanel'
import SearchBar from '@/components/SearchBar'
import FilterToggle from '@/components/FilterToggle'

const GalaxyView = dynamic(() => import('@/components/GalaxyView'), { ssr: false })

type Status = 'polling' | 'loading-graph' | 'ready' | 'failed'

function GalaxyPageInner() {
  const { runId } = useParams<{ runId: string }>()
  const searchParams = useSearchParams()
  const repoFullName = searchParams.get('repo') ?? ''

  const [status, setStatus] = useState<Status>('polling')
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [highlightNodeId, setHighlightNodeId] = useState<string | undefined>()
  const [activeCluster, setActiveCluster] = useState<string | null>(null)
  const [dots, setDots] = useState('.')

  // Animate loading dots
  useEffect(() => {
    if (status !== 'polling') return
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500)
    return () => clearInterval(t)
  }, [status])

  // Poll job status
  useEffect(() => {
    if (status !== 'polling') return

    const poll = async () => {
      const res = await fetch(`/api/status/${runId}`)
      const data = await res.json()

      if (data.status === 'complete') {
        setStatus('loading-graph')
        const graphRes = await fetch(`/api/graph/${data.repoId}`)
        const graph: GraphData = await graphRes.json()
        setGraphData(graph)
        setStatus('ready')
      } else if (data.status === 'failed') {
        setStatus('failed')
      }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [runId, status])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    setHighlightNodeId(node.id)
  }, [])

  const handleNavigate = useCallback((nodeId: string) => {
    const node = graphData?.nodes.find(n => n.id === nodeId)
    if (node) {
      setSelectedNode(node)
      setHighlightNodeId(nodeId)
    }
  }, [graphData])

  const clusters = graphData
    ? [...new Set(graphData.nodes.map(n => n.clusterGroup))].sort()
    : []

  const filteredGraph: GraphData | null = graphData && activeCluster
    ? {
        nodes: graphData.nodes.filter(n => n.clusterGroup === activeCluster),
        edges: graphData.edges.filter(
          e =>
            graphData.nodes.find(n => n.id === e.source && n.clusterGroup === activeCluster) &&
            graphData.nodes.find(n => n.id === e.target && n.clusterGroup === activeCluster)
        ),
      }
    : graphData

  if (status === 'polling' || status === 'loading-graph') {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <div className="relative w-32 h-32">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white animate-pulse"
              style={{
                width: Math.random() * 4 + 1,
                height: Math.random() * 4 + 1,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`,
                opacity: Math.random() * 0.8 + 0.2,
              }}
            />
          ))}
        </div>
        <p className="text-zinc-400 text-sm">Mapping {repoFullName}{dots}</p>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Analysis failed. The repo may be too large or private.</p>
          <a href="/" className="text-indigo-400 hover:text-indigo-300 text-sm">← Try another repo</a>
        </div>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <a href="/" className="text-zinc-500 hover:text-white text-sm">← deepspace</a>
          <span className="text-zinc-400 text-sm">{repoFullName}</span>
        </div>
        {graphData && (
          <SearchBar
            nodes={graphData.nodes}
            onSelect={id => { setHighlightNodeId(id); handleNavigate(id) }}
          />
        )}
      </div>

      {/* Cluster filters */}
      {graphData && (
        <div className="absolute bottom-4 left-4 z-10">
          <FilterToggle
            clusters={clusters}
            activeCluster={activeCluster}
            onToggle={setActiveCluster}
          />
        </div>
      )}

      {/* Galaxy */}
      {filteredGraph && (
        <GalaxyView
          graphData={filteredGraph}
          onNodeClick={handleNodeClick}
          highlightNodeId={highlightNodeId}
        />
      )}

      {/* File panel */}
      <FilePanel
        node={selectedNode}
        graphData={graphData ?? { nodes: [], edges: [] }}
        repoFullName={repoFullName}
        onNavigate={handleNavigate}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  )
}

export default function GalaxyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-zinc-400 text-sm">Loading...</p></div>}>
      <GalaxyPageInner />
    </Suspense>
  )
}
