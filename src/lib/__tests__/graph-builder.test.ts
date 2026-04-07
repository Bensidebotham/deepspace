import { describe, it, expect } from 'vitest'
import { buildGraph, resolveImport } from '../graph-builder'
import type { ParsedFile } from '@/types/graph'

describe('resolveImport', () => {
  it('resolves relative import to sibling file', () => {
    const allPaths = ['src/a.ts', 'src/b.ts']
    expect(resolveImport('./b', 'src/a.ts', allPaths)).toBe('src/b.ts')
  })
  it('resolves relative import with extension', () => {
    const allPaths = ['src/a.ts', 'src/b.tsx']
    expect(resolveImport('./b', 'src/a.ts', allPaths)).toBe('src/b.tsx')
  })
  it('resolves index file imports', () => {
    const allPaths = ['src/a.ts', 'src/utils/index.ts']
    expect(resolveImport('./utils', 'src/a.ts', allPaths)).toBe('src/utils/index.ts')
  })
  it('returns null for external packages', () => {
    const allPaths = ['src/a.ts']
    expect(resolveImport('react', 'src/a.ts', allPaths)).toBeNull()
  })
})

describe('buildGraph', () => {
  it('creates one node per file', () => {
    const files: ParsedFile[] = [
      { path: 'src/a.ts', language: 'typescript', lineCount: 10, imports: [] },
      { path: 'src/b.ts', language: 'typescript', lineCount: 20, imports: [] },
    ]
    const graph = buildGraph(files)
    expect(graph.nodes).toHaveLength(2)
    expect(graph.nodes.map(n => n.id)).toEqual(expect.arrayContaining(['src/a.ts', 'src/b.ts']))
  })

  it('creates an edge for each resolved import', () => {
    const files: ParsedFile[] = [
      { path: 'src/a.ts', language: 'typescript', lineCount: 10, imports: ['./b'] },
      { path: 'src/b.ts', language: 'typescript', lineCount: 20, imports: [] },
    ]
    const graph = buildGraph(files)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]).toMatchObject({ source: 'src/a.ts', target: 'src/b.ts', type: 'import' })
  })

  it('ignores unresolvable external imports', () => {
    const files: ParsedFile[] = [
      { path: 'src/a.ts', language: 'typescript', lineCount: 10, imports: ['react', 'lodash'] },
    ]
    const graph = buildGraph(files)
    expect(graph.edges).toHaveLength(0)
  })

  it('assigns clusterGroup from top-level directory', () => {
    const files: ParsedFile[] = [
      { path: 'components/Button.tsx', language: 'typescript', lineCount: 10, imports: [] },
      { path: 'lib/utils.ts', language: 'typescript', lineCount: 5, imports: [] },
    ]
    const graph = buildGraph(files)
    const button = graph.nodes.find(n => n.path === 'components/Button.tsx')!
    const utils = graph.nodes.find(n => n.path === 'lib/utils.ts')!
    expect(button.clusterGroup).toBe('components')
    expect(utils.clusterGroup).toBe('lib')
  })

  it('assigns higher importanceScore to files with more inbound imports', () => {
    const files: ParsedFile[] = [
      { path: 'lib/utils.ts', language: 'typescript', lineCount: 5, imports: [] },
      { path: 'a.ts', language: 'typescript', lineCount: 10, imports: ['./lib/utils'] },
      { path: 'b.ts', language: 'typescript', lineCount: 10, imports: ['./lib/utils'] },
      { path: 'c.ts', language: 'typescript', lineCount: 10, imports: ['./lib/utils'] },
    ]
    const graph = buildGraph(files)
    const utils = graph.nodes.find(n => n.path === 'lib/utils.ts')!
    const a = graph.nodes.find(n => n.path === 'a.ts')!
    expect(utils.importanceScore).toBeGreaterThan(a.importanceScore)
  })

  it('degree equals total connections (in + out)', () => {
    const files: ParsedFile[] = [
      { path: 'a.ts', language: 'typescript', lineCount: 5, imports: ['./b'] },
      { path: 'b.ts', language: 'typescript', lineCount: 5, imports: ['./c'] },
      { path: 'c.ts', language: 'typescript', lineCount: 5, imports: [] },
    ]
    const graph = buildGraph(files)
    const b = graph.nodes.find(n => n.path === 'b.ts')!
    expect(b.degree).toBe(2) // 1 inbound from a, 1 outbound to c
  })
})
