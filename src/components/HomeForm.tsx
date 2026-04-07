'use client'

import { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function HomeForm() {
  const { data: session } = useSession()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: url }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    const { runId, repoFullName } = await res.json()
    router.push(`/galaxy/${runId}?repo=${encodeURIComponent(repoFullName)}`)
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">deepspace</h1>
        <p className="text-zinc-400 text-lg">Explore any codebase as an interactive galaxy</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-lg">
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="w-full px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-sm"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? 'Launching...' : 'Explore repo →'}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px w-20 bg-zinc-700" />
        <span className="text-zinc-500 text-sm">or</span>
        <div className="h-px w-20 bg-zinc-700" />
      </div>

      {session ? (
        <p className="text-zinc-400 text-sm">
          Signed in as <span className="text-white">{session.user?.name}</span> — private repos enabled
        </p>
      ) : (
        <button
          onClick={() => signIn('github')}
          className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700"
        >
          Sign in with GitHub for private repos
        </button>
      )}
    </div>
  )
}
