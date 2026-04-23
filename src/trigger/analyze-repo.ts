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
    const { repoFullName } = payload
    // User OAuth token takes priority; fall back to server PAT for unauthenticated requests
    const token = payload.token ?? process.env.GITHUB_TOKEN
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
