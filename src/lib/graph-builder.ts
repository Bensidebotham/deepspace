import type { ParsedFile, GraphData, GraphNode, GraphEdge } from '@/types/graph'

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js']

function tryExtensions(base: string, allPaths: string[]): string | null {
  if (allPaths.includes(base)) return base
  for (const ext of EXTENSIONS) {
    if (allPaths.includes(base + ext)) return base + ext
  }
  return null
}

// Resolve ./ and ../ segments in a path string
function normalizePath(path: string): string {
  const parts = path.split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '..') out.pop()
    else if (part !== '.') out.push(part)
  }
  return out.join('/')
}

export function resolveImport(
  importStr: string,
  fromPath: string,
  allPaths: string[]
): string | null {
  // @/ alias — try src/ prefix first, then root
  if (importStr.startsWith('@/')) {
    const rest = importStr.slice(2)
    return (
      tryExtensions('src/' + rest, allPaths) ??
      tryExtensions(rest, allPaths)
    )
  }

  // ~/  alias — common alternative to @/
  if (importStr.startsWith('~/')) {
    const rest = importStr.slice(2)
    return (
      tryExtensions('src/' + rest, allPaths) ??
      tryExtensions(rest, allPaths)
    )
  }

  // Ignore bare external packages
  if (!importStr.startsWith('.') && !importStr.startsWith('/')) return null

  const fromDir = fromPath.split('/').slice(0, -1).join('/')
  const joined  = fromDir ? `${fromDir}/${importStr}` : importStr
  const base    = normalizePath(joined)  // resolves ../ and ./

  return tryExtensions(base, allPaths)
}

function clusterGroup(filePath: string): string {
  const segments = filePath.split('/')
  // For src/app/..., src/components/..., etc — use the second segment
  if (segments[0] === 'src' && segments.length > 2) return segments[1]
  // For top-level files inside a single folder
  if (segments.length > 1) return segments[0]
  return 'root'
}

export function buildGraph(files: ParsedFile[]): GraphData {
  const allPaths = files.map(f => f.path)
  const inboundCount: Record<string, number> = {}

  for (const f of files) inboundCount[f.path] = 0

  const edges: GraphEdge[] = []
  for (const file of files) {
    for (const imp of file.imports) {
      const resolved = resolveImport(imp, file.path, allPaths)
      if (resolved && resolved !== file.path) {
        edges.push({ source: file.path, target: resolved, type: 'import' })
        inboundCount[resolved] = (inboundCount[resolved] ?? 0) + 1
      }
    }
  }

  const maxInbound = Math.max(1, ...Object.values(inboundCount))

  const outboundCount: Record<string, number> = {}
  for (const e of edges) {
    outboundCount[e.source] = (outboundCount[e.source] ?? 0) + 1
  }

  const nodes: GraphNode[] = files.map(file => {
    const inbound = inboundCount[file.path] ?? 0
    const outbound = outboundCount[file.path] ?? 0
    return {
      id: file.path,
      path: file.path,
      language: file.language,
      lineCount: file.lineCount,
      degree: inbound + outbound,
      clusterGroup: clusterGroup(file.path),
      importanceScore: inbound / maxInbound,
    }
  })

  return { nodes, edges }
}
