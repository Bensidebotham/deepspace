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
