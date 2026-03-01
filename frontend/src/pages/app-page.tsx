import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SetupPanel } from '@/components/SetupPanel'
import { GeneratedUI } from '@/components/GeneratedUI'
import type { VerifiedTask } from '@/types'

export function AppPage() {
  const [componentCode, setComponentCode] = useState<string | null>(null)
  const [verifiedTasks, setVerifiedTasks] = useState<VerifiedTask[]>([])
  const [layoutHint, setLayoutHint] = useState('')
  const [chatHistory, setChatHistory] = useState<string[]>([])
  const [profileId, setProfileId] = useState<string | null>(null)

  function handleSetupComplete(code: string, tasks: VerifiedTask[], hint: string, pid: string) {
    setComponentCode(code)
    setVerifiedTasks(tasks)
    setLayoutHint(hint)
    setChatHistory([])
    setProfileId(pid)
  }

  function handleReset() {
    setComponentCode(null)
    setVerifiedTasks([])
    setLayoutHint('')
    setChatHistory([])
    setProfileId(null)
  }

  function handleCodeUpdate(newCode: string, refinementMessage: string) {
    setComponentCode(newCode)
    setChatHistory((prev) => [...prev, refinementMessage])
  }

  const showResult = componentCode !== null

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

          {showResult ? (
            <button
              onClick={handleReset}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              New session
            </button>
          ) : (
            <div className="w-20" />
          )}
        </div>
      </header>

      <main
        className={`mx-auto px-6 py-12 ${showResult ? 'max-w-5xl' : 'max-w-lg'}`}
      >
        {!showResult && (
          <>
            <div className="mb-10">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                New session
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect to any website, describe what you want, and get a live dashboard.
              </p>
            </div>
            <SetupPanel
              onComplete={(code, tasks, hint, pid) => handleSetupComplete(code, tasks, hint, pid)}
            />
          </>
        )}

        {showResult && componentCode && (
          <GeneratedUI
            componentCode={componentCode}
            verifiedTasks={verifiedTasks}
            layoutHint={layoutHint}
            chatHistory={chatHistory}
            onCodeUpdate={handleCodeUpdate}
            profileId={profileId!}
          />
        )}
      </main>
    </div>
  )
}
