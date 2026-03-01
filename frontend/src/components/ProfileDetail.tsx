import { useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react'
import * as api from '@/lib/api'
import type { ProfileDetail as ProfileDetailType, Instruction, VerifiedTask } from '@/types'

interface ProfileDetailProps {
  profileId: string
  onBack: () => void
  onGenerateUI: (tasks: VerifiedTask[], layoutHint: string) => void
  onLoadDashboard: (profileId: string) => void
}

export function ProfileDetail({ profileId, onBack, onGenerateUI, onLoadDashboard }: ProfileDetailProps) {
  const [profile, setProfile] = useState<ProfileDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasDashboard, setHasDashboard] = useState(false)

  const [newToolPrompt, setNewToolPrompt] = useState('')
  const [addingTool, setAddingTool] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    api.getProfile(profileId)
      .then(setProfile)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    api.getDashboard(profileId)
      .then(() => setHasDashboard(true))
      .catch(() => setHasDashboard(false))
  }, [profileId])

  function toolsAsVerifiedTasks(tools: Instruction[]): VerifiedTask[] {
    return tools.map((t) => ({
      id: t.name,
      description: t.description,
      instructions: t.instructions,
      output_schema: t.output_schema,
      sample_output: t.sample_output,
      display_hint: t.display_hint,
      type: t.type,
    }))
  }

  async function handleGenerateUI() {
    if (!profile) return
    setGenerating(true)
    try {
      const tasks = toolsAsVerifiedTasks(profile.tools)
      onGenerateUI(tasks, 'dashboard')
    } finally {
      setGenerating(false)
    }
  }

  async function handleAddTool(e: React.FormEvent) {
    e.preventDefault()
    if (!newToolPrompt.trim()) return
    setAddingTool(true)
    setAddError(null)
    try {
      const newTool = await api.addTool(profileId, newToolPrompt.trim())
      setProfile((prev) => {
        if (!prev) return prev
        const asInstruction: Instruction = {
          name: newTool.id,
          description: newTool.description,
          instructions: newTool.instructions,
          output_schema: newTool.output_schema,
          sample_output: newTool.sample_output,
          display_hint: newTool.display_hint,
          type: newTool.type,
        }
        return {
          ...prev,
          tools: [...prev.tools, asInstruction],
          tool_count: prev.tool_count + 1,
        }
      })
      setNewToolPrompt('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add tool')
    } finally {
      setAddingTool(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-destructive">{error ?? 'Profile not found'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Profiles
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">
            {profile.site_name || 'Unknown site'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasDashboard && (
            <button
              onClick={() => onLoadDashboard(profileId)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              View Dashboard
            </button>
          )}
          <button
            onClick={handleGenerateUI}
            disabled={generating || profile.tools.length === 0}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? 'Generating…' : 'Generate UI'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {profile.tools.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">No tools yet. Add one below.</p>
          </div>
        )}

        {profile.tools.map((tool) => (
          <ToolCard key={tool.name} tool={tool} profileId={profileId} />
        ))}
      </div>

      <form onSubmit={handleAddTool} className="flex gap-2">
        <input
          type="text"
          value={newToolPrompt}
          onChange={(e) => setNewToolPrompt(e.target.value)}
          placeholder="Describe a new tool to add…"
          disabled={addingTool}
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={addingTool || !newToolPrompt.trim()}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
        >
          {addingTool ? 'Adding…' : 'Add tool'}
        </button>
      </form>
      {addError && <p className="text-xs text-destructive">{addError}</p>}
    </div>
  )
}

function ToolCard({ tool, profileId }: { tool: Instruction; profileId: string }) {
  const [liveData, setLiveData] = useState<unknown>(tool.sample_output)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  async function fetchLive() {
    setFetching(true)
    setFetchError(null)
    try {
      const result = await api.getData(tool.name, profileId)
      if (result.success) setLiveData(result.data)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Fetch failed')
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{tool.description}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tool.display_hint} &middot; {tool.type}
          </p>
        </div>
        {tool.type === 'data' && (
          <button
            onClick={fetchLive}
            disabled={fetching}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${fetching ? 'animate-spin' : ''}`} />
            {fetching ? 'Fetching…' : 'Refresh'}
          </button>
        )}
      </div>

      <pre className="rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap">
        {JSON.stringify(liveData, null, 2)}
      </pre>
      {fetchError && <p className="text-xs text-destructive">{fetchError}</p>}
    </div>
  )
}
