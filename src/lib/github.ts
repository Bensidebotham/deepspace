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
