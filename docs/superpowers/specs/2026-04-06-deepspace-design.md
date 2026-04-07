# Deepspace — Design Spec
*2026-04-06*

## Overview

Deepspace is a web app that turns any GitHub repository into an interactive 3D galaxy visualization. Files are stars, import relationships are edges, and related modules cluster together like constellations. The goal is to help developers — especially new hires — quickly build a mental model of an unfamiliar codebase.

---

## Architecture

### Stack
- **Next.js + TypeScript** — frontend + API routes
- **react-force-graph-3d** — 3D galaxy visualization (Three.js-based)
- **NextAuth.js** — GitHub OAuth
- **Trigger.dev** — background repo analysis pipeline
- **PostgreSQL + Prisma** — graph cache
- **OpenAI API** — lazy file summaries (generated on first panel open, then cached)
- **Vercel + Neon** — deployment

### High-level flow
1. User pastes a public GitHub URL or signs in with GitHub OAuth and selects a repo
2. API route triggers a Trigger.dev background job
3. Frontend shows galaxy-forming animation while job runs (stars appear as files are processed)
4. Job completes → client fetches graph data → full 3D galaxy renders
5. User navigates: zoom/pan/rotate, click stars to explore, follow connections between files

---

## Analysis Pipeline (Trigger.dev Job)

Runs server-side as a background job. Steps:

1. **Fetch** — use Octokit to recursively fetch the repo file tree and raw file contents. Use GitHub OAuth token for private repos; unauthenticated for public.
2. **Filter** — exclude binary files, assets (images, fonts, videos), lock files, and generated files.
3. **Parse imports** — extract dependency relationships per file:
   - TypeScript/JS: parse `import`/`require` statements via `ts-morph` or regex
   - Python: parse `import`/`from x import` statements
   - Other languages: best-effort regex fallback
4. **Build graph** — nodes are files, edges are import relationships. Node metadata: `path`, `language`, `lineCount`, `degree` (connection count).
5. **Cluster assignment** — group files by top-level directory (`components/`, `api/`, `lib/`, etc.). Used to seed force simulation and assign colors.
6. **Importance scoring** — files with more inbound connections (imported by many others) receive a higher score → rendered as larger, brighter stars.
7. **Cache** — store the full graph JSON in Postgres, keyed by `repoFullName + latestCommitSHA`. Re-analysis only triggers on SHA change.

### Edge cases
- **Large repos (1000+ files):** cap initial render at top 500 nodes by importance score; "load all" toggle available
- **Monorepos:** treat each top-level package directory as its own cluster
- **Analysis failure:** surface error state with retry button

---

## Data Model

```typescript
// Node
{
  id: string           // file path
  path: string
  language: string
  lineCount: number
  degree: number       // total connections
  clusterGroup: string // top-level directory name
  importanceScore: number
}

// Edge
{
  source: string  // file path
  target: string  // file path
  type: 'import' | 'dynamic'
}

// CachedRepo (Postgres)
{
  repoFullName: string   // e.g. "vercel/next.js"
  commitSHA: string
  graphJson: Json        // { nodes, edges }
  analyzedAt: DateTime
  userId: string | null  // null for public repos
}
```

---

## Frontend — Galaxy Visualization

**Library:** `react-force-graph-3d`

### Visual design
- Deep black/space background
- Stars sized by `importanceScore` — highly connected files are large bright stars, utilities are small dim ones
- Stars colored by `clusterGroup` — each top-level directory gets a distinct color
- Edges rendered as thin, semi-transparent lines — faint at rest, highlighted on selection
- Force simulation naturally clusters related files into constellations

### Interactions
| Action | Behavior |
|--------|----------|
| Zoom / pan / rotate | Free 3D navigation |
| Hover a star | Tooltip: filename + language |
| Click a star | File detail panel opens |
| Click panel connection | Camera flies to that star |
| Search bar | Matching star pulses, camera flies to it |
| Filter toggle | Show/hide by language or cluster |

### Loading experience
- Poll job status while Trigger.dev job runs
- Poll job status endpoint every 2 seconds; animate stars appearing progressively as a visual effect while polling (not true streaming — full graph loads on job completion)
- Typical analysis time: 5–15 seconds for a standard repo

---

## File Detail Panel

Slides in from the right when a star is clicked. Galaxy stays visible behind it.

### Sections
1. **Header** — filename, path, language badge, line count, "Open on GitHub" link
2. **AI Summary** — 2–3 sentence plain-English description of the file's role (generated once via OpenAI, cached in Postgres)
3. **Connections** — two lists: "Imports" and "Imported by". Each entry is clickable to navigate to that file.
4. **Code Preview** — first ~50 lines with syntax highlighting. "View full file" expands or links to GitHub.

### Visual highlight
While a panel is open: selected star glows brighter, direct connections highlight, rest of galaxy dims slightly.

---

## Authentication

- **No login required** for public repos — paste URL and go (unauthenticated GitHub API, 60 req/hr limit)
- **GitHub OAuth** (NextAuth.js) for private repos — OAuth token used by Trigger.dev job server-side
- Analyzed private repos are scoped to the authenticated user — no cross-user access

---

## Deployment

| Service | Purpose |
|---------|---------|
| Vercel | Next.js app hosting |
| Neon | Serverless Postgres (graph cache, summaries) |
| Trigger.dev | Background analysis jobs |
| OpenAI API | File summaries |
| GitHub OAuth App | Auth + private repo access |
