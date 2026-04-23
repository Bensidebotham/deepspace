import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateFileSummary } from '@/lib/ai'
import { fetchFileContent } from '@/lib/github'

export async function POST(req: NextRequest) {
  const { repoFullName, filePath, fileContent } = await req.json()

  if (!repoFullName || !filePath) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const existing = await prisma.fileSummary.findUnique({
    where: { repoFullName_filePath: { repoFullName, filePath } },
  })
  if (existing) return NextResponse.json({ summary: existing.summary })

  // Fetch real content from GitHub if the client didn't send it
  let content = fileContent as string | undefined
  if (!content) {
    const [owner, repo] = repoFullName.split('/')
    content = await fetchFileContent(owner, repo, filePath)
  }

  const summary = await generateFileSummary(filePath, content ?? '')

  await prisma.fileSummary.create({
    data: { repoFullName, filePath, summary },
  })

  return NextResponse.json({ summary })
}
