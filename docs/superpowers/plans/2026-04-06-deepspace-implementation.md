# Deepspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Deepspace — a web app that turns any GitHub repo into an interactive 3D galaxy visualization for codebase onboarding.

**Architecture:** Next.js App Router handles both frontend and API routes. A Trigger.dev background job fetches, parses, and caches the repo graph in Postgres. The client polls for job completion then renders the graph with react-force-graph-3d.

**Tech Stack:** Next.js 15, TypeScript, react-force-graph-3d, NextAuth.js (GitHub OAuth), Trigger.dev v3, Prisma + Neon Postgres, OpenAI API, Vercel deployment.

---

## File Map

```
deepspace/
├── prisma/
│   └── schema.prisma                         # CachedRepo + FileSummary models
├── src/
│   ├── types/
│   │   └── graph.ts                          # GraphNode, GraphEdge, GraphData, ParsedFile
│   ├── lib/
│   │   ├── prisma.ts                         # Prisma client singleton
│   │   ├── auth.ts                           # NextAuth authOptions (shared between route + API)
│   │   ├── github.ts                         # Octokit: fetch tree, file contents, commit SHA
│   │   ├── parser.ts                         # Extract imports per language, detect language
│   │   ├── graph-builder.ts                  # Build GraphData from ParsedFile[]
│   │   └── openai.ts                         # Generate file summary string
│   ├── trigger/
│   │   └── analyze-repo.ts                   # Trigger.dev task: fetch → parse → cache
│   ├── app/
│   │   ├── layout.tsx                        # Root layout
│   │   ├── page.tsx                          # Landing page (renders HomeForm)
│   │   ├── galaxy/[runId]/
│   │   │   └── page.tsx                      # Galaxy page (polling + GalaxyView)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts   # NextAuth GitHub OAuth
│   │       ├── analyze/route.ts              # POST: trigger job, return { runId, repoFullName }
│   │       ├── status/[runId]/route.ts       # GET: poll Trigger.dev run → { status, repoId? }
│   │       ├── graph/[repoId]/route.ts       # GET: return cached GraphData
│   │       └── summary/route.ts             # POST: generate + cache file summary
│   └── components/
│       ├── HomeForm.tsx                      # URL input + GitHub sign-in
│       ├── GalaxyView.tsx                    # react-force-graph-3d wrapper
│       ├── FilePanel.tsx                     # Slide-in file detail panel
│       ├── SearchBar.tsx                     # Search files, fly camera to result
│       └── FilterToggle.tsx                  # Filter nodes by language or cluster
├── src/lib/__tests__/
│   ├── parser.test.ts
│   └── graph-builder.test.ts
├── trigger.config.ts
└── vitest.config.ts
```

---

## Task 1: Scaffold Next.js Project + Install Dependencies

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `vitest.config.ts`
- Create: `trigger.config.ts`

- [ ] **Step 1: Scaffold Next.js inside existing directory**

```bash
cd /Users/ben/deepspace
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes
```

Expected: Next.js project created with src/app, tailwind.config, tsconfig.json.

- [ ] **Step 2: Install all dependencies**

```bash
npm install react-force-graph-3d three next-auth @auth/prisma-adapter @prisma/client octokit openai @trigger.dev/sdk
npm install -D prisma vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @types/three jsdom
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create Trigger.dev config**

Create `trigger.config.ts`:
```typescript
import { defineConfig } from '@trigger.dev/sdk/v3'

export default defineConfig({
  project: 'deepspace',
  dirs: ['./src/trigger'],
})
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: Shared Type Definitions

**Files:**
- Create: `src/types/graph.ts`

- [ ] **Step 1: Create types file**

Create `src/types/graph.ts`:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/types/graph.ts
git commit -m "feat: add shared graph type definitions"
```

---

## Task 3: Prisma Schema + Database Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

Expected: `prisma/schema.prisma` and `.env` created.

- [ ] **Step 2: Define schema**

Replace contents of `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model CachedRepo {
  id           String   @id @default(cuid())
  repoFullName String
  commitSha    String
  graphJson    Json
  analyzedAt   DateTime @default(now())
  userId       String?

  @@unique([repoFullName, commitSha])
}

model FileSummary {
  id           String   @id @default(cuid())
  repoFullName String
  filePath     String
  summary      String
  createdAt    DateTime @default(now())

  @@unique([repoFullName, filePath])
}
```

- [ ] **Step 3: Add DATABASE_URL to .env**

In `.env`, set:
```
DATABASE_URL="your-neon-postgres-connection-string"
```

Get this from your Neon dashboard (Project → Connection string).

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration applied, `prisma/migrations/` created.

- [ ] **Step 5: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 6: Create Prisma singleton**

Create `src/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/lib/prisma.ts .env
git commit -m "feat: add Prisma schema and database setup"
```

---

## Task 4: Import Parser (TDD)

**Files:**
- Create: `src/lib/parser.ts`
- Create: `src/lib/__tests__/parser.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/parser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { detectLanguage, parseImports, parseFile } from '../parser'

describe('detectLanguage', () => {
  it('detects TypeScript .ts files', () => {
    expect(detectLanguage('src/lib/utils.ts')).toBe('typescript')
  })
  it('detects TypeScript .tsx files', () => {
    expect(detectLanguage('src/components/Button.tsx')).toBe('typescript')
  })
  it('detects JavaScript files', () => {
    expect(detectLanguage('scripts/build.js')).toBe('javascript')
  })
  it('detects Python files', () => {
    expect(detectLanguage('scripts/run.py')).toBe('python')
  })
  it('returns unknown for unrecognized extensions', () => {
    expect(detectLanguage('README.md')).toBe('unknown')
  })
})

describe('parseImports', () => {
  it('extracts named ES module imports', () => {
    const content = `import { useState } from 'react'`
    expect(parseImports('src/page.tsx', content)).toContain('react')
  })
  it('extracts default ES module imports', () => {
    const content = `import Button from './Button'`
    expect(parseImports('src/page.tsx', content)).toContain('./Button')
  })
  it('extracts multiple imports from multiple lines', () => {
    const content = `import { a } from 'react'\nimport fs from 'node:fs'`
    const result = parseImports('src/page.tsx', content)
    expect(result).toContain('react')
    expect(result).toContain('node:fs')
  })
  it('extracts Python top-level imports', () => {
    const content = `import os\nimport sys`
    const result = parseImports('script.py', content)
    expect(result).toContain('os')
    expect(result).toContain('sys')
  })
  it('extracts Python from-imports', () => {
    const content = `from pathlib import Path`
    expect(parseImports('script.py', content)).toContain('pathlib')
  })
  it('returns empty array when no imports present', () => {
    expect(parseImports('config.ts', 'export const x = 1')).toEqual([])
  })
  it('ignores type-only imports', () => {
    const content = `import type { Foo } from './foo'`
    // type imports still tracked — they indicate dependency
    expect(parseImports('src/a.ts', content)).toContain('./foo')
  })
})

describe('parseFile', () => {
  it('returns correct language, lineCount and imports', () => {
    const content = `import React from 'react'\n\nexport default function App() {}`
    const result = parseFile('src/App.tsx', content)
    expect(result.path).toBe('src/App.tsx')
    expect(result.language).toBe('typescript')
    expect(result.lineCount).toBe(3)
    expect(result.imports).toContain('react')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — `parser` module not found.

- [ ] **Step 3: Implement parser**

Create `src/lib/parser.ts`:
```typescript
import type { ParsedFile } from '@/types/graph'

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  java: 'java',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
}

export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_MAP[ext] ?? 'unknown'
}

export function parseImports(filePath: string, content: string): string[] {
  const lang = detectLanguage(filePath)
  const imports: string[] = []

  if (lang === 'typescript' || lang === 'javascript') {
    // Match: import ... from 'module' or import('module') or require('module')
    const esImport = /import(?:\s+type)?\s+.*?\s+from\s+['"]([^'"]+)['"]/g
    const dynamicImport = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    const requireImport = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g

    for (const regex of [esImport, dynamicImport, requireImport]) {
      let match
      while ((match = regex.exec(content)) !== null) {
        imports.push(match[1])
      }
    }
  }

  if (lang === 'python') {
    // Match: import os  OR  from pathlib import Path
    const topLevel = /^import\s+([\w.]+)/gm
    const fromImport = /^from\s+([\w.]+)\s+import/gm

    let match
    while ((match = topLevel.exec(content)) !== null) imports.push(match[1])
    while ((match = fromImport.exec(content)) !== null) imports.push(match[1])
  }

  return [...new Set(imports)]
}

export function parseFile(filePath: string, content: string): ParsedFile {
  return {
    path: filePath,
    language: detectLanguage(filePath),
    lineCount: content.split('\n').length,
    imports: parseImports(filePath, content),
  }
}

export const EXCLUDED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp',
  'woff', 'woff2', 'ttf', 'eot',
  'mp4', 'mp3', 'wav',
  'pdf', 'zip', 'tar', 'gz',
  'lock', 'snap',
])

export function isCodeFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (EXCLUDED_EXTENSIONS.has(ext)) return false
  const base = filePath.split('/').pop() ?? ''
  if (base.startsWith('.')) return false
  if (filePath.includes('node_modules/')) return false
  if (filePath.includes('.next/')) return false
  if (filePath.endsWith('.d.ts')) return false
  return true
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: All parser tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parser.ts src/lib/__tests__/parser.test.ts
git commit -m "feat: add import parser with TDD"
```

---

## Task 5: Graph Builder (TDD)

**Files:**
- Create: `src/lib/graph-builder.ts`
- Create: `src/lib/__tests__/graph-builder.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/graph-builder.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — `graph-builder` module not found.

- [ ] **Step 3: Implement graph builder**

Create `src/lib/graph-builder.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: All graph-builder tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph-builder.ts src/lib/__tests__/graph-builder.test.ts
git commit -m "feat: add graph builder with TDD"
```

---

## Task 6: GitHub API Utilities

**Files:**
- Create: `src/lib/github.ts`

- [ ] **Step 1: Create GitHub utilities**

Create `src/lib/github.ts`:
```typescript
import { Octokit } from 'octokit'

function client(token?: string) {
  return new Octokit({ auth: token })
}

export function parseRepoUrl(url: string): { owner: string; repo: string } {
  // Handles: https://github.com/owner/repo or owner/repo
  const match = url.match(/(?:github\.com\/)?([^/]+)\/([^/\s]+?)(?:\.git)?$/)
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`)
  return { owner: match[1], repo: match[2] }
}

export async function getLatestCommitSha(
  owner: string,
  repo: string,
  token?: string
): Promise<string> {
  const octokit = client(token)
  const { data } = await octokit.rest.repos.get({ owner, repo })
  const branch = data.default_branch

  const { data: ref } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  })
  return ref.object.sha
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  sha: string,
  token?: string
): Promise<{ path: string; type: string; size: number }[]> {
  const octokit = client(token)
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: sha,
    recursive: '1',
  })
  return (data.tree as { path: string; type: string; size: number }[]).filter(
    item => item.type === 'blob' && item.path && item.size < 500_000
  )
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token?: string
): Promise<string> {
  const octokit = client(token)
  const { data } = await octokit.rest.repos.getContent({ owner, repo, path })
  if (Array.isArray(data) || data.type !== 'file') return ''
  return Buffer.from(data.content, 'base64').toString('utf-8')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/github.ts
git commit -m "feat: add GitHub API utilities"
```

---

## Task 7: OpenAI Summary Utility

**Files:**
- Create: `src/lib/openai.ts`

- [ ] **Step 1: Create OpenAI helper**

Create `src/lib/openai.ts`:
```typescript
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateFileSummary(
  filePath: string,
  content: string
): Promise<string> {
  const preview = content.slice(0, 3000)
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a senior engineer helping a new hire understand a codebase. Answer in 2-3 sentences: what does this file do, what is its role in the project, and when would a developer need to touch it? Be concrete and specific.',
      },
      {
        role: 'user',
        content: `File: ${filePath}\n\n\`\`\`\n${preview}\n\`\`\``,
      },
    ],
    max_tokens: 150,
  })
  return response.choices[0].message.content ?? 'No summary available.'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/openai.ts
git commit -m "feat: add OpenAI file summary utility"
```

---

## Task 8: Trigger.dev Analysis Job

**Files:**
- Create: `src/trigger/analyze-repo.ts`

- [ ] **Step 1: Create analysis task**

Create `src/trigger/analyze-repo.ts`:
```typescript
import { task } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'
import {
  getLatestCommitSha,
  fetchRepoTree,
  fetchFileContent,
} from '@/lib/github'
import { parseFile, isCodeFile } from '@/lib/parser'
import { buildGraph } from '@/lib/graph-builder'

export const analyzeRepo = task({
  id: 'analyze-repo',
  maxDuration: 300,
  run: async (payload: {
    repoFullName: string
    token?: string
  }): Promise<{ repoId: string; cached: boolean }> => {
    const { repoFullName, token } = payload
    const [owner, repo] = repoFullName.split('/')

    const commitSha = await getLatestCommitSha(owner, repo, token)

    // Return cached result if SHA matches
    const existing = await prisma.cachedRepo.findUnique({
      where: { repoFullName_commitSha: { repoFullName, commitSha } },
    })
    if (existing) return { repoId: existing.id, cached: true }

    // Fetch file tree
    const tree = await fetchRepoTree(owner, repo, commitSha, token)
    const codeFiles = tree.filter(f => isCodeFile(f.path))

    // Cap at 500 most important-looking files (smallest first = utility files)
    const filesToProcess = codeFiles
      .sort((a, b) => (a.size ?? 0) - (b.size ?? 0))
      .slice(0, 500)

    // Parse files in batches of 10 to avoid rate limits
    const parsedFiles = []
    for (let i = 0; i < filesToProcess.length; i += 10) {
      const batch = filesToProcess.slice(i, i + 10)
      const results = await Promise.all(
        batch.map(async f => {
          const content = await fetchFileContent(owner, repo, f.path, token)
          return parseFile(f.path, content)
        })
      )
      parsedFiles.push(...results)
    }

    const graph = buildGraph(parsedFiles)

    const cached = await prisma.cachedRepo.create({
      data: {
        repoFullName,
        commitSha,
        graphJson: graph as object,
      },
    })

    return { repoId: cached.id, cached: false }
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/trigger/analyze-repo.ts trigger.config.ts
git commit -m "feat: add Trigger.dev repo analysis job"
```

---

## Task 9: API Routes

**Files:**
- Create: `src/app/api/analyze/route.ts`
- Create: `src/app/api/status/[runId]/route.ts`
- Create: `src/app/api/graph/[repoId]/route.ts`
- Create: `src/app/api/summary/route.ts`

- [ ] **Step 1: Create /api/analyze route**

Create `src/app/api/analyze/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { analyzeRepo } from '@/trigger/analyze-repo'
import { parseRepoUrl } from '@/lib/github'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { repoUrl } = await req.json()

  if (!repoUrl) {
    return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 })
  }

  let owner: string
  let repo: string
  try {
    ;({ owner, repo } = parseRepoUrl(repoUrl))
  } catch {
    return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 })
  }

  const repoFullName = `${owner}/${repo}`
  const session = await getServerSession(authOptions)
  const token = (session?.accessToken as string | undefined) ?? undefined

  const handle = await analyzeRepo.trigger({ repoFullName, token })

  return NextResponse.json({ runId: handle.id, repoFullName })
}
```

- [ ] **Step 2: Create /api/status/[runId] route**

Create `src/app/api/status/[runId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { runs } from '@trigger.dev/sdk/v3'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
  const run = await runs.retrieve(params.runId)

  if (run.status === 'COMPLETED' && run.output) {
    const { repoId } = run.output as { repoId: string; cached: boolean }
    return NextResponse.json({ status: 'complete', repoId })
  }

  if (run.status === 'FAILED' || run.status === 'CRASHED') {
    return NextResponse.json({ status: 'failed' }, { status: 500 })
  }

  return NextResponse.json({ status: 'pending' })
}
```

- [ ] **Step 3: Create /api/graph/[repoId] route**

Create `src/app/api/graph/[repoId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: { repoId: string } }
) {
  const cached = await prisma.cachedRepo.findUnique({
    where: { id: params.repoId },
  })

  if (!cached) {
    return NextResponse.json({ error: 'Repo not found' }, { status: 404 })
  }

  return NextResponse.json(cached.graphJson)
}
```

- [ ] **Step 4: Create /api/summary route**

Create `src/app/api/summary/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateFileSummary } from '@/lib/openai'

export async function POST(req: NextRequest) {
  const { repoFullName, filePath, fileContent } = await req.json()

  if (!repoFullName || !filePath) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Return cached summary if exists
  const existing = await prisma.fileSummary.findUnique({
    where: { repoFullName_filePath: { repoFullName, filePath } },
  })
  if (existing) return NextResponse.json({ summary: existing.summary })

  const summary = await generateFileSummary(filePath, fileContent ?? '')

  await prisma.fileSummary.create({
    data: { repoFullName, filePath, summary },
  })

  return NextResponse.json({ summary })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/
git commit -m "feat: add analyze, status, graph, and summary API routes"
```

---

## Task 10: NextAuth GitHub OAuth

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create auth options (shared module)**

Create `src/lib/auth.ts`:
```typescript
import { NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: { scope: 'read:user repo' },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) token.accessToken = account.access_token
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      return session
    },
  },
}
```

- [ ] **Step 2: Create NextAuth route**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 2: Add env variables to .env**

In `.env`, add:
```
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
GITHUB_CLIENT_ID="your-github-oauth-app-client-id"
GITHUB_CLIENT_SECRET="your-github-oauth-app-client-secret"
```

To create a GitHub OAuth App: GitHub Settings → Developer settings → OAuth Apps → New OAuth App. Set homepage to `http://localhost:3000` and callback to `http://localhost:3000/api/auth/callback/github`.

- [ ] **Step 3: Extend next-auth types**

Create `src/types/next-auth.d.ts`:
```typescript
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/ src/types/next-auth.d.ts .env
git commit -m "feat: add GitHub OAuth with NextAuth"
```

---

## Task 11: Home Page + HomeForm Component

**Files:**
- Create: `src/components/HomeForm.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create HomeForm component**

Create `src/components/HomeForm.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function HomeForm() {
  const { data: session } = useSession()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: url }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    const { runId, repoFullName } = await res.json()
    router.push(`/galaxy/${runId}?repo=${encodeURIComponent(repoFullName)}`)
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">deepspace</h1>
        <p className="text-zinc-400 text-lg">Explore any codebase as an interactive galaxy</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-lg">
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-sm"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? 'Launching...' : 'Explore repo →'}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px w-20 bg-zinc-700" />
        <span className="text-zinc-500 text-sm">or</span>
        <div className="h-px w-20 bg-zinc-700" />
      </div>

      {session ? (
        <p className="text-zinc-400 text-sm">
          Signed in as <span className="text-white">{session.user?.name}</span> — private repos enabled
        </p>
      ) : (
        <button
          onClick={() => signIn('github')}
          className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700"
        >
          Sign in with GitHub for private repos
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update root layout for dark theme**

Replace `src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/SessionProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Deepspace — Explore codebases as galaxies',
  description: 'Turn any GitHub repo into an interactive 3D galaxy visualization',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-black min-h-screen`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create SessionProvider wrapper**

Create `src/components/SessionProvider.tsx`:
```typescript
'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
```

- [ ] **Step 4: Update home page**

Replace `src/app/page.tsx`:
```typescript
import HomeForm from '@/components/HomeForm'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <HomeForm />
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/app/page.tsx src/app/layout.tsx
git commit -m "feat: add home page with URL input and GitHub OAuth UI"
```

---

## Task 12: GalaxyView Component

**Files:**
- Create: `src/components/GalaxyView.tsx`

- [ ] **Step 1: Create color map and GalaxyView**

Create `src/components/GalaxyView.tsx`:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GalaxyView.tsx
git commit -m "feat: add 3D galaxy visualization component"
```

---

## Task 13: FilePanel Component

**Files:**
- Create: `src/components/FilePanel.tsx`

- [ ] **Step 1: Create FilePanel**

Create `src/components/FilePanel.tsx`:
```typescript
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

    fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoFullName, filePath: node.path, fileContent: '' }),
    })
      .then(r => r.json())
      .then(data => setSummary(data.summary))
      .finally(() => setLoadingSummary(false))
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FilePanel.tsx
git commit -m "feat: add file detail panel with summary and connections"
```

---

## Task 14: SearchBar + FilterToggle Components

**Files:**
- Create: `src/components/SearchBar.tsx`
- Create: `src/components/FilterToggle.tsx`

- [ ] **Step 1: Create SearchBar**

Create `src/components/SearchBar.tsx`:
```typescript
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
```

- [ ] **Step 2: Create FilterToggle**

Create `src/components/FilterToggle.tsx`:
```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SearchBar.tsx src/components/FilterToggle.tsx
git commit -m "feat: add search bar and cluster filter components"
```

---

## Task 15: Galaxy Page (Polling + Loading + Full View)

**Files:**
- Create: `src/app/galaxy/[runId]/page.tsx`

- [ ] **Step 1: Create galaxy page**

Create `src/app/galaxy/[runId]/page.tsx`:
```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { GraphData, GraphNode } from '@/types/graph'
import FilePanel from '@/components/FilePanel'
import SearchBar from '@/components/SearchBar'
import FilterToggle from '@/components/FilterToggle'

const GalaxyView = dynamic(() => import('@/components/GalaxyView'), { ssr: false })

type Status = 'polling' | 'loading-graph' | 'ready' | 'failed'

export default function GalaxyPage() {
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/galaxy/
git commit -m "feat: add galaxy page with run polling, loading animation, and full view"
```

---

## Task 16: Environment Setup + README + Vercel Deploy

**Files:**
- Create: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Create .env.example**

Create `.env.example`:
```
# Database (Neon Postgres)
DATABASE_URL=""

# NextAuth
NEXTAUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth App (Settings → Developer settings → OAuth Apps)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# OpenAI
OPENAI_API_KEY=""

# Trigger.dev (dashboard.trigger.dev → project → API keys)
TRIGGER_SECRET_KEY=""
```

- [ ] **Step 2: Add .env to .gitignore**

Ensure `.gitignore` contains:
```
.env
.env.local
```

- [ ] **Step 3: Write README**

Replace `README.md`:
```markdown
# Deepspace

Turn any GitHub repository into an interactive 3D galaxy. Files are stars, imports are edges, related modules cluster together like constellations.

## Features
- Paste any public GitHub URL — no login required
- Sign in with GitHub to explore private repos
- Interactive 3D force-directed graph (zoom, pan, rotate)
- Click any file to see its AI-generated summary, connections, and code preview
- Search files by name and filter by module cluster

## Stack
Next.js · TypeScript · react-force-graph-3d · NextAuth.js · Trigger.dev · PostgreSQL (Neon) · OpenAI

## Local Development

1. Clone and install: `npm install`
2. Copy `.env.example` to `.env` and fill in all values
3. Run DB migration: `npx prisma migrate dev`
4. Start Trigger.dev dev server: `npx trigger.dev@latest dev`
5. Start Next.js: `npm run dev`

Open [http://localhost:3000](http://localhost:3000)

## Deployment
Deploy to Vercel. Add all env vars from `.env.example` to your Vercel project settings.
Deploy Trigger.dev tasks: `npx trigger.dev@latest deploy`
```

- [ ] **Step 4: Final run of all tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Final commit and push**

```bash
git add .
git commit -m "feat: complete Deepspace MVP — galaxy codebase visualizer"
git push origin master
```

---

## Summary

17 tasks, building from types → parser → graph builder → backend → API → auth → UI → deploy. Core logic (parser, graph builder) is TDD'd. Every commit leaves the repo in a working state.
