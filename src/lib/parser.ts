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
