'use client'

interface Props {
  clusters: string[]
  activeCluster: string | null
  onToggle: (cluster: string | null) => void
}

export default function FilterToggle({ clusters, activeCluster, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onToggle(null)}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
          activeCluster === null
            ? 'bg-indigo-600 text-white'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
        }`}
      >
        All
      </button>
      {clusters.map(cluster => (
        <button
          key={cluster}
          onClick={() => onToggle(cluster === activeCluster ? null : cluster)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            activeCluster === cluster
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {cluster}
        </button>
      ))}
    </div>
  )
}
