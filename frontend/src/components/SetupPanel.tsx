import { useState } from 'react'
import * as api from '@/lib/api'
import type { Phase, TaskPlan, VerifiedTask } from '@/types'

interface SetupPanelProps {
  onComplete: (code: string, verifiedTasks: VerifiedTask[], layoutHint: string, profileId: string) => void
}

const PHASE_LABELS: Record<string, string> = {
  planning: 'Planning tasks…',
  verifying: 'Verifying tasks with browser agent…',
  generating: 'Generating UI…',
}

export function SetupPanel({ onComplete }: SetupPanelProps) {
  const [step, setStep] = useState<'url' | 'prompt'>('url')
  const [url, setUrl] = useState('')
  const [prompt, setPrompt] = useState('')
  const [phase, setPhase] = useState<Phase>('auth')
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [profileId, setProfileId] = useState('')

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setError(null)
    setLoading(true)
    setStatusMsg('Opening browser…')
    try {
      const result = await api.startAuth(url.trim())
      setProfileId(result.profile_id)
      setStep('prompt')
      setPhase('prompt')
      setStatusMsg('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open browser')
    } finally {
      setLoading(false)
    }
  }

  async function handlePrompt(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim()) return
    setError(null)
    setLoading(true)

    try {
      // Step 1: Plan
      setPhase('planning')
      setStatusMsg(PHASE_LABELS.planning)
      const plan: TaskPlan = await api.planTasks(url.trim(), prompt.trim())

      // Step 2: Verify
      setPhase('verifying')
      setStatusMsg(`Verifying ${plan.tasks.length} task(s) with browser agent…`)
      const verifyResult = await api.verifyTasks(url.trim(), plan.tasks, profileId)
      const verifiedTasks = verifyResult.verified_tasks

      if (verifiedTasks.length === 0) {
        throw new Error('No tasks could be verified. Try a more specific prompt.')
      }

      // Step 3: Generate
      setPhase('generating')
      setStatusMsg(PHASE_LABELS.generating)
      const { component_code } = await api.generateUI(verifiedTasks, plan.layout_hint)

      onComplete(component_code, verifiedTasks, plan.layout_hint, profileId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('prompt')
    } finally {
      setLoading(false)
      setStatusMsg('')
    }
  }

  if (step === 'url') {
    return (
      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Target website URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com"
            required
            autoFocus
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            A browser window will open so you can log in manually before the agent runs.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? statusMsg || 'Opening browser…' : 'Open browser to log in →'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handlePrompt} className="space-y-4">
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          Browser opened at {url}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Log in if needed — the agent will use your session automatically.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          What do you want to see?
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Show me my open pull requests and top repositories…"
          rows={4}
          required
          autoFocus
          disabled={loading}
          className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none disabled:opacity-60"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && statusMsg && (
        <div className="rounded-lg border border-border bg-card/50 px-4 py-3 space-y-2">
          <p className="text-sm text-muted-foreground">{statusMsg}</p>
          <div className="h-1 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full w-2/3 rounded-full bg-accent animate-pulse" />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !prompt.trim()}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
      >
        {loading ? 'Working…' : 'Generate dashboard →'}
      </button>
    </form>
  )
}
