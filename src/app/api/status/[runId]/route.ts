import { NextRequest, NextResponse } from 'next/server'
import { runs } from '@trigger.dev/sdk/v3'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const run = await runs.retrieve(runId)

  if (run.status === 'COMPLETED' && run.output) {
    const { repoId } = run.output as { repoId: string; cached: boolean }
    return NextResponse.json({ status: 'complete', repoId })
  }

  if (run.status === 'FAILED' || run.status === 'CRASHED') {
    return NextResponse.json({ status: 'failed' }, { status: 500 })
  }

  return NextResponse.json({ status: 'pending' })
}
