export interface GraphNode {
  id: string           // file path — unique identifier
  path: string
  language: string
  lineCount: number
  degree: number       // total import connections (in + out)
  clusterGroup: string // top-level directory name (e.g. "components", "lib")
  importanceScore: number  // 0–1, based on inbound connection count
}

export interface GraphEdge {
  source: string  // file path
  target: string  // file path
  type: 'import' | 'dynamic'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface ParsedFile {
  path: string
  language: string
  lineCount: number
  imports: string[]  // raw import strings as written in source
}
