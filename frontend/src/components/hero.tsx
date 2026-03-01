import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-20">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />

      <div className="pointer-events-none absolute top-1/3 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[120px]" />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-xs font-medium text-muted-foreground">AI-Powered Web Scraping</span>
        </div>

        <h1 className="text-balance text-5xl font-bold leading-[1.1] tracking-tight text-foreground md:text-7xl">
          Your browser,
          <br />
          <span className="text-accent">your dashboard.</span>
        </h1>

        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
          Describe what you want to see from any website. BiB sends an AI agent to scrape the data and renders a clean,
          custom dashboard — no code required.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link to="/app">
            <Button size="lg" variant="accent">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/how-it-works">
            <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary">
              See How It Works
            </Button>
          </Link>
        </div>

        <div className="mt-20 w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-destructive/60" />
            <div className="h-3 w-3 rounded-full bg-chart-4/60" />
            <div className="h-3 w-3 rounded-full bg-accent/60" />
            <span className="ml-3 font-mono text-xs text-muted-foreground">bib://agent</span>
          </div>
          <div className="p-6 font-mono text-sm leading-relaxed">
            <p className="text-muted-foreground">
              <span className="text-accent">{'>'}</span> Target: <span className="text-foreground">github.com</span>
            </p>
            <p className="mt-2 text-muted-foreground">
              <span className="text-accent">{'>'}</span> Prompt:{' '}
              <span className="text-foreground">{'"Show me all my repos and open PRs"'}</span>
            </p>
            <p className="mt-4 text-muted-foreground">
              <span className="text-accent">{'>'}</span> Profiling site structure...
            </p>
            <p className="text-muted-foreground">
              <span className="text-accent">{'>'}</span> Scraping 2 datasets...
            </p>
            <p className="mt-2 text-accent">{'>'} Dashboard ready.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
