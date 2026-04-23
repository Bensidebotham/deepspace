'use client'

import { useEffect, useState } from 'react'
import type { GraphNode, GraphData } from '@/types/graph'

interface Props {
  node: GraphNode | null
  graphData: GraphData
  repoFullName: string
  onNavigate: (nodeId: string) => void
  onClose: () => void
}

export default function FilePanel({ node, graphData, repoFullName, onNavigate, onClose }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  useEffect(() => {
    if (!node) return
    setSummary(null)
    setLoadingSummary(true)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoFullName, filePath: node.path, fileContent: '' }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => setSummary(data.summary ?? 'No summary available.'))
      .catch(() => setSummary('Could not load summary.'))
      .finally(() => { clearTimeout(timeout); setLoadingSummary(false) })

    return () => { clearTimeout(timeout); controller.abort() }
  }, [node, repoFullName])

  if (!node) return null

  const imports = graphData.edges
    .filter(e => e.source === node.id)
    .map(e => e.target)

  const importedBy = graphData.edges
    .filter(e => e.target === node.id)
    .map(e => e.source)

  const githubUrl = `https://github.com/${repoFullName}/blob/HEAD/${node.path}`

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-zinc-950 border-l border-zinc-800 overflow-y-auto z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-zinc-800">
        <div>
          <p className="text-white font-medium text-sm truncate max-w-[280px]">
            {node.path.split('/').pop()}
          </p>
          <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-[280px]">{node.path}</p>
          <div className="flex gap-2 mt-2">
            <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
              {node.language}
            </span>
            <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
              {node.lineCount} lines
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white text-xl leading-none ml-2"
        >
          ×
        </button>
      </div>

      {/* Summary */}
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Summary</h3>
        {loadingSummary ? (
          <div className="h-16 bg-zinc-900 rounded animate-pulse" />
        ) : (
          <p className="text-zinc-300 text-sm leading-relaxed">{summary}</p>
        )}
      </div>

      {/* Connections */}
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-zinc-400 text-xs uppercase tracking-wider mb-2">
          Imports ({imports.length})
        </h3>
        <ul className="space-y-1">
          {imports.slice(0, 10).map(path => (
            <li key={path}>
              <button
                onClick={() => onNavigate(path)}
                className="text-indigo-400 hover:text-indigo-300 text-xs truncate max-w-full text-left"
              >
                {path}
              </button>
            </li>
          ))}
          {imports.length === 0 && <li className="text-zinc-600 text-xs">None</li>}
        </ul>

        <h3 className="text-zinc-400 text-xs uppercase tracking-wider mt-4 mb-2">
          Imported by ({importedBy.length})
        </h3>
        <ul className="space-y-1">
          {importedBy.slice(0, 10).map(path => (
            <li key={path}>
              <button
                onClick={() => onNavigate(path)}
                className="text-indigo-400 hover:text-indigo-300 text-xs truncate max-w-full text-left"
              >
                {path}
              </button>
            </li>
          ))}
          {importedBy.length === 0 && <li className="text-zinc-600 text-xs">None</li>}
        </ul>
      </div>

      {/* GitHub link */}
      <div className="p-4">
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-zinc-300 underline"
        >
          View on GitHub →
        </a>
      </div>
    </div>
  )
}
