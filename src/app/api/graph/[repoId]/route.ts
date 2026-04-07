import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  const { repoId } = await params
  const cached = await prisma.cachedRepo.findUnique({
    where: { id: repoId },
  })

  if (!cached) {
    return NextResponse.json({ error: 'Repo not found' }, { status: 404 })
  }

  return NextResponse.json(cached.graphJson)
}
