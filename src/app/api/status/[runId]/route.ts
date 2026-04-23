import { NextRequest, NextResponse } from 'next/server'
import { runs } from '@trigger.dev/sdk/v3'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params

  let run
  try {
    run = await runs.retrieve(runId)
  } catch (err) {
    console.error('[status] runs.retrieve failed:', err)
    return NextResponse.json({ status: 'failed', error: 'Could not reach Trigger.dev' })
  }

  if (run.status === 'COMPLETED' && run.output) {
    const { repoId } = run.output as { repoId: string; cached: boolean }
    return NextResponse.json({ status: 'complete', repoId })
  }

  if (run.status === 'FAILED' || run.status === 'CRASHED' || run.status === 'TIMED_OUT' || run.status === 'CANCELED') {
    return NextResponse.json({ status: 'failed' })
  }

  return NextResponse.json({ status: 'pending' })
}
