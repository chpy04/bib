import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ScraperForm } from '@/components/scraper-form'
import { TEST_COMPONENT_CODE, TEST_SESSION_ID } from '@/lib/test-component'

const RUNNER_URL = '/runner.html'
const isTestingMode = import.meta.env.VITE_TESTING_MODE === 'true'

export function AppPage() {
  const { id: profileId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [componentCode, setComponentCode] = useState<string | null>(
    isTestingMode ? TEST_COMPONENT_CODE : null
  )
  const [sessionId, setSessionId] = useState<string | null>(isTestingMode ? TEST_SESSION_ID : null)
  const [runnerReady, setRunnerReady] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Load profile from URL param on mount
  useEffect(() => {
    if (!profileId || isTestingMode) return
    setProfileLoading(true)
    fetch(`/api/profiles/${profileId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Profile not found (${res.status})`)
        return res.json()
      })
      .then((data) => {
        setSessionId(data.session_id)
        setComponentCode(data.component_code ?? null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      })
      .finally(() => setProfileLoading(false))
  }, [profileId])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === 'runner-ready') setRunnerReady(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (!runnerReady || !componentCode || !iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage({ type: 'RUN_CODE', code: componentCode }, '*')
  }, [runnerReady, componentCode])

  async function handleFeedback(e: React.FormEvent) {
    e.preventDefault()
    if (!feedback.trim() || !sessionId) return
    setError(null)
    setFeedbackLoading(true)
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: feedback, session_id: sessionId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.detail || res.statusText || 'Request failed')
      const code = data?.componentCode ?? data?.component_code
      if (typeof code !== 'string') throw new Error('Response missing componentCode string')
      setComponentCode(code)
      setFeedback('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setFeedbackLoading(false)
    }
  }

  function handleNewSession() {
    setSessionId(null)
    setComponentCode(null)
    setFeedback('')
    setError(null)
    navigate('/app')
  }

  const showResult = componentCode !== null

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
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
          <div className="w-14" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        {profileLoading && (
          <p className="text-sm text-muted-foreground">Loading profile…</p>
        )}
        {showResult && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleNewSession}
              className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground hover:bg-secondary/80"
            >
              New Scrape
            </button>
          </div>
        )}

        {!showResult && (
          <div className="mb-10">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">New Scrape</h1>
            <p className="mt-2 text-muted-foreground">
              Enter a target URL and describe the data you want. BiB will handle the rest.
            </p>
          </div>
        )}

        {!showResult && (
          <ScraperForm
            onSuccess={(code, sid) => {
              setComponentCode(code)
              setSessionId(sid)
              navigate(`/app/${sid}`, { replace: true })
            }}
            isTestingMode={isTestingMode}
          />
        )}

        <div
          className={`mt-8 transition-opacity ${
            showResult ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'
          }`}
          aria-hidden={!showResult}
        >
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Response</h2>
          <iframe
            ref={iframeRef}
            src={RUNNER_URL}
            title="Rendered response"
            className="w-full min-h-[400px] rounded-xl border border-border bg-white"
            sandbox="allow-scripts allow-same-origin"
          />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          {sessionId !== TEST_SESSION_ID && (
            <form onSubmit={handleFeedback} className="mt-4 flex gap-2">
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Provide feedback to iterate…"
                className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="submit"
                disabled={feedbackLoading || !feedback.trim()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
              >
                {feedbackLoading ? 'Updating…' : 'Update'}
              </button>
            </form>
          )}
          {isTestingMode && (
            <p className="mt-4 text-xs text-muted-foreground">
              Testing mode — no API calls. Set VITE_TESTING_MODE=false to use the real backend.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
