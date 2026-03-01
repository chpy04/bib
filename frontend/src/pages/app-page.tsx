import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SetupPanel } from '@/components/SetupPanel'
import { GeneratedUI } from '@/components/GeneratedUI'
import { ProfileGrid } from '@/components/ProfileGrid'
import { ProfileDetail } from '@/components/ProfileDetail'
import * as api from '@/lib/api'
import type { VerifiedTask } from '@/types'

type AppView = 'grid' | 'detail' | 'setup' | 'result'

export function AppPage() {
  const [view, setView] = useState<AppView>('grid')
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  // GeneratedUI state
  const [componentCode, setComponentCode] = useState<string | null>(null)
  const [verifiedTasks, setVerifiedTasks] = useState<VerifiedTask[]>([])
  const [layoutHint, setLayoutHint] = useState('')
  const [chatHistory, setChatHistory] = useState<string[]>([])
  const [profileId, setProfileId] = useState<string | null>(null)

  function handleSelectProfile(id: string) {
    setSelectedProfileId(id)
    setView('detail')
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
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-accent">
              <span className="text-xs font-bold text-accent-foreground">B</span>
            </div>
            <span className="text-sm font-semibold text-foreground">BiB</span>
          </div>

          {view !== 'grid' ? (
            <button
              onClick={handleBackToGrid}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              All profiles
            </button>
          ) : (
            <div className="w-20" />
          )}
        </div>
      </header>

      <main
        className={`mx-auto px-6 py-12 ${view === 'setup' ? 'max-w-lg' : 'max-w-5xl'}`}
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
