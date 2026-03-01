import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SetupPanel } from '@/components/SetupPanel'
import { GeneratedUI } from '@/components/GeneratedUI'
import { ProfileGrid } from '@/components/ProfileGrid'
import { ProfileDetail } from '@/components/ProfileDetail'
import { AgentLoader } from '@/components/agent-loader'
import * as api from '@/lib/api'
import type { VerifiedTask } from '@/types'

type AppView = 'grid' | 'detail' | 'setup' | 'result' | 'ui-prompt'

export function AppPage() {
  const [view, setView] = useState<AppView>('grid')
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  // GeneratedUI state
  const [componentCode, setComponentCode] = useState<string | null>(null)
  const [verifiedTasks, setVerifiedTasks] = useState<VerifiedTask[]>([])
  const [layoutHint, setLayoutHint] = useState('')
  const [chatHistory, setChatHistory] = useState<string[]>([])
  const [profileId, setProfileId] = useState<string | null>(null)

  const [loadingProfile, setLoadingProfile] = useState(false)
  const [profileLoaderPhase, setProfileLoaderPhase] = useState(0)

  const PROFILE_LOAD_PHASES = [
    'Looking up dashboard...',
    'Loading saved component...',
  ]

  async function handleSelectProfile(id: string) {
    setSelectedProfileId(id)
    setLoadingProfile(true)
    setProfileLoaderPhase(0)

    try {
      // Try loading an existing dashboard first
      setProfileLoaderPhase(0)
      const dashboard = await api.getDashboard(id)
      setProfileLoaderPhase(1)
      setComponentCode(dashboard.component_code)
      setVerifiedTasks(dashboard.verified_tasks)
      setLayoutHint(dashboard.layout_hint)
      setChatHistory(dashboard.chat_history)
      setProfileId(dashboard.profile_id)
      setView('result')
    } catch {
      // No dashboard yet — check if profile has tools
      try {
        const profile = await api.getProfile(id)
        if (profile.tools.length === 0) {
          // No tools — fall back to the detail view
          setView('detail')
        } else {
          // Has tools but no dashboard — let user describe the UI
          const tasks: VerifiedTask[] = profile.tools.map((t) => ({
            id: t.name,
            description: t.description,
            instructions: t.instructions,
            output_schema: t.output_schema,
            sample_output: t.sample_output,
            display_hint: t.display_hint,
            type: t.type,
          }))
          setVerifiedTasks(tasks)
          setProfileId(id)
          setView('ui-prompt')
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
        setView('detail')
      }
    } finally {
      setLoadingProfile(false)
      setProfileLoaderPhase(0)
    }
  }

  function handleNewProfile() {
    setView('setup')
  }

  function handleSetupComplete(code: string, tasks: VerifiedTask[], hint: string, pid: string) {
    setComponentCode(code)
    setVerifiedTasks(tasks)
    setLayoutHint(hint)
    setChatHistory([])
    setProfileId(pid)
    setSelectedProfileId(pid)
    setView('result')
  }

  async function handleGenerateUI(tasks: VerifiedTask[], hint: string) {
    const pid = selectedProfileId ?? profileId
    if (!pid) return

    try {
      const { component_code } = await api.generateUI(tasks, hint, pid, '', '')
      setComponentCode(component_code)
      setVerifiedTasks(tasks)
      setLayoutHint(hint)
      setChatHistory([])
      setProfileId(pid)
      setView('result')
    } catch (err) {
      console.error('UI generation failed:', err)
    }
  }

  async function handleLoadDashboard(dashboardProfileId: string) {
    try {
      const dashboard = await api.getDashboard(dashboardProfileId)
      setComponentCode(dashboard.component_code)
      setVerifiedTasks(dashboard.verified_tasks)
      setLayoutHint(dashboard.layout_hint)
      setChatHistory(dashboard.chat_history)
      setProfileId(dashboard.profile_id)
      setSelectedProfileId(dashboard.profile_id)
      setView('result')
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    }
  }

  function handleCodeUpdate(newCode: string, refinementMessage: string) {
    setComponentCode(newCode)
    setChatHistory((prev) => [...prev, refinementMessage])
  }

  const [uiPrompt, setUiPrompt] = useState('')
  const [generatingFromPrompt, setGeneratingFromPrompt] = useState(false)
  const [uiPromptError, setUiPromptError] = useState<string | null>(null)
  const [uiLoaderPhase, setUiLoaderPhase] = useState(0)

  const UI_PROMPT_PHASES = [
    'Reading verified tasks...',
    'Designing layout...',
    'Generating React component...',
  ]

  async function handleUIPromptSubmit(e: FormEvent) {
    e.preventDefault()
    if (!uiPrompt.trim() || !profileId) return
    setGeneratingFromPrompt(true)
    setUiPromptError(null)
    setUiLoaderPhase(0)

    try {
      setUiLoaderPhase(1)
      const { component_code } = await api.generateUI(
        verifiedTasks,
        uiPrompt.trim(),
        profileId,
        '',
        '',
      )
      setUiLoaderPhase(2)
      setComponentCode(component_code)
      setLayoutHint(uiPrompt.trim())
      setChatHistory([])
      setView('result')
    } catch (err) {
      setUiPromptError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGeneratingFromPrompt(false)
      setUiLoaderPhase(0)
    }
  }

  function handleBackToGrid() {
    setView('grid')
    setSelectedProfileId(null)
    setComponentCode(null)
    setVerifiedTasks([])
    setLayoutHint('')
    setChatHistory([])
    setProfileId(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          {view === 'grid' ? (
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          ) : (
            <button
              onClick={handleBackToGrid}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}

          <img src="/logo.svg" alt="BiB" className="h-12 w-auto" />

          <div className="w-20" />
        </div>
      </header>

      <main
        className={`mx-auto px-6 py-12 ${view === 'setup' || view === 'ui-prompt' ? 'max-w-lg' : view === 'result' ? 'max-w-7xl' : 'max-w-5xl'}`}
      >
        {view === 'grid' && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Profiles
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your saved dashboards and data tools.
              </p>
            </div>
            <ProfileGrid
              onSelectProfile={handleSelectProfile}
              onNewProfile={handleNewProfile}
            />
          </>
        )}

        {view === 'detail' && selectedProfileId && (
          <ProfileDetail
            profileId={selectedProfileId}
            onBack={handleBackToGrid}
            onGenerateUI={handleGenerateUI}
            onLoadDashboard={handleLoadDashboard}
          />
        )}

        {view === 'setup' && (
          <>
            <div className="mb-10">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                New profile
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect to a website and describe what you want.
              </p>
            </div>
            <SetupPanel onComplete={(code, tasks, hint, pid) => handleSetupComplete(code, tasks, hint, pid)} />
          </>
        )}

        {view === 'ui-prompt' && profileId && (
          <>
            <div className="mb-10">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Design your dashboard
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Describe how the dashboard should look.
              </p>
            </div>
            <form onSubmit={handleUIPromptSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  How should the dashboard look?
                </label>
                <textarea
                  value={uiPrompt}
                  onChange={(e) => setUiPrompt(e.target.value)}
                  placeholder="Two-column layout with cards for repos and a table for PRs…"
                  rows={4}
                  required
                  autoFocus
                  disabled={generatingFromPrompt}
                  className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none disabled:opacity-60"
                />
              </div>

              {uiPromptError && (
                <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                  {uiPromptError}
                </p>
              )}

              {generatingFromPrompt ? (
                <AgentLoader phases={UI_PROMPT_PHASES} currentPhase={uiLoaderPhase} />
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setView('detail')
                      setUiPrompt('')
                    }}
                    className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
                  >
                    ← Back to tasks
                  </button>
                  <button
                    type="submit"
                    disabled={!uiPrompt.trim()}
                    className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Generate dashboard →
                  </button>
                </div>
              )}
            </form>
          </>
        )}

        {loadingProfile && <AgentLoader phases={PROFILE_LOAD_PHASES} currentPhase={profileLoaderPhase} />}

        {view === 'result' && componentCode && profileId && (
          <GeneratedUI
            componentCode={componentCode}
            verifiedTasks={verifiedTasks}
            layoutHint={layoutHint}
            chatHistory={chatHistory}
            onCodeUpdate={handleCodeUpdate}
            profileId={profileId}
          />
        )}
      </main>
    </div>
  )
}
