import type { ParsedFile, GraphData, GraphNode, GraphEdge } from '@/types/graph'

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js']

export function resolveImport(
  importStr: string,
  fromPath: string,
  allPaths: string[]
): string | null {
  // External packages start with a letter or @
  if (!importStr.startsWith('.') && !importStr.startsWith('/')) return null

  const fromDir = fromPath.split('/').slice(0, -1).join('/')
  const base = fromDir ? `${fromDir}/${importStr.replace(/^\.\//, '')}` : importStr.replace(/^\.\//, '')
  const normalized = base.replace(/\/\//g, '/')

  // Try exact match first, then try adding extensions
  if (allPaths.includes(normalized)) return normalized

  for (const ext of EXTENSIONS) {
    const candidate = `${normalized}${ext}`
    if (allPaths.includes(candidate)) return candidate
  }

  return null
}

export function buildGraph(files: ParsedFile[]): GraphData {
  const allPaths = files.map(f => f.path)
  const inboundCount: Record<string, number> = {}

  // Initialize
  for (const f of files) inboundCount[f.path] = 0

  // Build edges + count inbound
  const edges: GraphEdge[] = []
  for (const file of files) {
    for (const imp of file.imports) {
      const resolved = resolveImport(imp, file.path, allPaths)
      if (resolved) {
        edges.push({ source: file.path, target: resolved, type: 'import' })
        inboundCount[resolved] = (inboundCount[resolved] ?? 0) + 1
      }
    }
  }

  const maxInbound = Math.max(1, ...Object.values(inboundCount))

  // Build nodes
  const outboundCount: Record<string, number> = {}
  for (const e of edges) {
    outboundCount[e.source] = (outboundCount[e.source] ?? 0) + 1
  }

  const nodes: GraphNode[] = files.map(file => {
    const inbound = inboundCount[file.path] ?? 0
    const outbound = outboundCount[file.path] ?? 0
    const segments = file.path.split('/')
    return {
      id: file.path,
      path: file.path,
      language: file.language,
      lineCount: file.lineCount,
      degree: inbound + outbound,
      clusterGroup: segments.length > 1 ? segments[0] : 'root',
      importanceScore: inbound / maxInbound,
    }
  })

  return { nodes, edges }
}
