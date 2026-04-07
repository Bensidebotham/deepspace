import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateFileSummary } from '@/lib/openai'

export async function POST(req: NextRequest) {
  const { repoFullName, filePath, fileContent } = await req.json()

  if (!repoFullName || !filePath) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

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
