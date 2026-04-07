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
