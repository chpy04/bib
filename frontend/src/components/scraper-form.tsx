import { useState } from 'react'
import { Globe, Sparkles, ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AgentLoader } from '@/components/agent-loader'
import { TEST_COMPONENT_CODE, TEST_SESSION_ID } from '@/lib/test-component'

type AppState = 'idle' | 'loading' | 'error'

type ScraperFormProps = {
  onSuccess: (componentCode: string, sessionId: string) => void
  isTestingMode?: boolean
}

export function ScraperForm({ onSuccess, isTestingMode = false }: ScraperFormProps) {
  const [url, setUrl] = useState('')
  const [prompt, setPrompt] = useState('')
  const [state, setState] = useState<AppState>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || !prompt.trim()) return

    setState('loading')
    setError(null)

    try {
      if (isTestingMode) {
        onSuccess(TEST_COMPONENT_CODE, TEST_SESSION_ID)
        setState('idle')
        return
      }

      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), prompt: prompt.trim() }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.detail || response.statusText || 'Request failed')
      }

      const code = data?.componentCode ?? data?.component_code
      const sessionId = data?.session_id
      if (typeof code !== 'string') throw new Error('Response missing componentCode string')
      if (typeof sessionId !== 'string') throw new Error('Response missing session_id')

      onSuccess(code, sessionId)
      setState('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setState('error')
    }
  }

  function handleReset() {
    setState('idle')
    setError(null)
  }

  if (state === 'loading') {
    return <AgentLoader />
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
          <span className="text-xl text-destructive">!</span>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        <Button
          variant="outline"
          onClick={handleReset}
          className="border-border text-foreground hover:bg-secondary"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="url" className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Globe className="h-4 w-4 text-accent" />
          Target URL
        </label>
        <Input
          id="url"
          type="url"
          placeholder="https://github.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-accent"
          required
        />
        <p className="text-xs text-muted-foreground">The website you want BiB to scrape data from.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="prompt" className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="h-4 w-4 text-accent" />
          What do you want to see?
        </label>
        <Textarea
          id="prompt"
          placeholder="Show me all my repositories and open pull requests..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="resize-none border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-accent"
          required
        />
        <p className="text-xs text-muted-foreground">
          Describe the data you want in natural language. Be specific about what fields matter.
        </p>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={!url.trim() || !prompt.trim()}
        variant="accent"
        className="disabled:opacity-40"
      >
        Launch Agent
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  )
}
