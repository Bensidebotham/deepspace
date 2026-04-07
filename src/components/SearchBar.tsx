'use client'

import { useState } from 'react'
import type { GraphNode } from '@/types/graph'

interface Props {
  nodes: GraphNode[]
  onSelect: (nodeId: string) => void
}

export default function SearchBar({ nodes, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const results = query.length > 1
    ? nodes.filter(n => n.path.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  return (
    <div className="relative w-72">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search files..."
        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-white text-sm rounded-lg placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
      />
      {open && results.length > 0 && (
        <ul className="absolute top-full mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden z-20">
          {results.map(node => (
            <li key={node.id}>
              <button
                onClick={() => { onSelect(node.id); setQuery(''); setOpen(false) }}
                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 truncate"
              >
                {node.path}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
