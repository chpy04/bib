import { Link } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Search, Download, KeyRound, LayoutDashboard, X } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'

const steps = [
  {
    number: '01',
    icon: Search,
    label: 'Profiler Agent',
    title: 'Profile the site',
    description:
      'A Browser Use agent visits the target site and builds a structured scrape plan — which pages to visit, what navigation steps are required, and the exact shape of the data available. It does not collect any real user data at this stage.',
    detail: [
      'Navigates to the target site in a real browser',
      'Identifies which pages hold the requested data',
      'Maps out the navigation steps to reach each page',
      'Defines field names, types, and structure for each dataset',
      'Outputs a typed scrape plan — not raw data',
    ],
    terminal: [
      '> Visiting github.com...',
      '> Identified: /repos → repository list',
      '> Identified: /pulls → open pull requests',
      '> Schema: { name, description, updated_at, url }',
      '> Plan ready. Handing off to scraper.',
    ],
  },
  {
    number: '02',
    icon: Download,
    label: 'Scraper Agent',
    title: 'Scrape the data',
    description:
      'A second agent picks up the scrape plan and executes it exactly. It navigates the site, extracts all requested fields, and returns a structured JSON object keyed by dataset name. The scraper follows the plan — it makes no decisions about what to collect.',
    detail: [
      'Receives the typed scrape plan from the profiler',
      'Follows each navigation step precisely',
      'Extracts all fields listed for each dataset',
      'Returns structured JSON matching the agreed schema',
      'Runs in the same authenticated browser session',
    ],
    terminal: [
      '> Following scrape plan...',
      '> Fetching repositories (page 1/3)...',
      '> Fetching open pull requests...',
      '> Extracted 42 repos, 7 open PRs',
      '> Returning structured JSON.',
    ],
  },
  {
    number: '03',
    icon: KeyRound,
    label: 'Auth Handling',
    title: 'Authenticate once',
    description:
      'If the target site requires a login, BiB opens the browser window and waits for you to sign in manually. Once authenticated, the session is saved and reused — you never log in again for that site.',
    detail: [
      'Browser runs with headless=False so you can see it',
      'If no saved session exists, opens the site\'s login page',
      'You sign in manually — BiB never touches your credentials',
      'Session cookies are saved to a local session file',
      'Subsequent runs load the saved session automatically',
    ],
    terminal: [
      '> Loading saved session...',
      '> No session found for github.com',
      '> Opening browser — please log in manually.',
      '> Session detected. Saving cookies.',
      '> Continuing as authenticated user.',
    ],
  },
  {
    number: '04',
    icon: LayoutDashboard,
    label: 'Dashboard',
    title: 'Render the dashboard',
    description:
      'Once the scraper returns structured JSON, an LLM generates a clean, custom dashboard layout. Each section maps to a dataset, every item links back to the real site, and the whole thing is rendered live in your browser.',
    detail: [
      'Structured JSON is passed to an LLM for layout generation',
      'Sections are created per dataset (e.g. Repos, Pull Requests)',
      'Every item includes a direct link back to the source page',
      'Dashboard is rendered live — no page reload needed',
      'You can refine the layout with follow-up prompts',
    ],
    terminal: [
      '> Received 42 repos, 7 open PRs',
      '> Generating dashboard layout...',
      '> Rendering: Repositories section',
      '> Rendering: Pull Requests section',
      '> Dashboard ready.',
    ],
  },
]

const outOfScope = [
  'Writing back to the site (no form fills, button clicks, or posts)',
  'Multiple simultaneous target sites in one session',
  'Persistent saved layouts across sessions',
  'Full re-auth flows on session expiry',
  'Self-healing selectors or DOM diffing',
  'Embedded passthrough browser views',
]

export function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-6 pb-24 pt-40 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[120px]" />

        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-xs font-medium text-muted-foreground">Under the hood</span>
          </div>
          <h1 className="text-balance text-5xl font-bold leading-[1.1] tracking-tight text-foreground md:text-6xl">
            How BiB works
          </h1>
          <p className="mt-6 max-w-xl mx-auto text-pretty text-lg leading-relaxed text-muted-foreground">
            Two AI agents — a profiler and a scraper — work in sequence to turn your plain-English request into a live, structured dashboard.
          </p>
        </div>
      </section>

      {/* Flow diagram */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-xl border border-border bg-card p-6 font-mono text-sm leading-loose">
            <p className="text-muted-foreground">User describes what they want</p>
            <p className="text-muted-foreground pl-4">│</p>
            <p className="text-muted-foreground pl-4">▼</p>
            <p className="text-accent font-semibold">── STEP 1: PROFILER ─────────────────────────</p>
            <p className="text-muted-foreground pl-4">Visits target site → maps navigation → defines schema</p>
            <p className="text-muted-foreground pl-4">Outputs: typed scrape plan (no real data)</p>
            <p className="text-muted-foreground pl-4">│</p>
            <p className="text-muted-foreground pl-4">▼</p>
            <p className="text-accent font-semibold">── STEP 2: SCRAPER ──────────────────────────</p>
            <p className="text-muted-foreground pl-4">Follows plan → navigates site → extracts data</p>
            <p className="text-muted-foreground pl-4">│</p>
            <p className="text-muted-foreground pl-4">├─ Site requires auth?</p>
            <p className="text-muted-foreground pl-8">│   ▼</p>
            <p className="text-muted-foreground pl-8">└── User logs in manually → session saved</p>
            <p className="text-muted-foreground pl-4">│</p>
            <p className="text-muted-foreground pl-4">▼</p>
            <p className="text-accent font-semibold">── DASHBOARD ────────────────────────────────</p>
            <p className="text-muted-foreground pl-4">LLM generates layout from structured JSON</p>
            <p className="text-muted-foreground pl-4">│</p>
            <p className="text-muted-foreground pl-4">▼</p>
            <p className="text-foreground font-semibold">User sees their custom dashboard → links back to real site</p>
          </div>
        </div>
      </section>

      {/* Step cards */}
      <section className="px-6 pb-32">
        <div className="mx-auto max-w-5xl space-y-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="grid gap-8 rounded-xl border border-border bg-card p-8 md:grid-cols-2"
            >
              {/* Left: description */}
              <div>
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary">
                    <step.icon className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-mono text-xs font-bold text-accent">{step.number} — {step.label}</p>
                    <h2 className="text-xl font-bold text-foreground">{step.title}</h2>
                  </div>
                </div>
                <p className="mb-6 leading-relaxed text-muted-foreground">{step.description}</p>
                <ul className="space-y-2">
                  {step.detail.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: terminal */}
              <div className="flex flex-col justify-center">
                <div className="overflow-hidden rounded-lg border border-border bg-background">
                  <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-chart-4/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-accent/60" />
                    <span className="ml-2 font-mono text-xs text-muted-foreground">bib://agent</span>
                  </div>
                  <div className="p-4 font-mono text-xs leading-loose">
                    {step.terminal.map((line, i) => (
                      <p
                        key={i}
                        className={
                          i === step.terminal.length - 1
                            ? 'text-accent'
                            : 'text-muted-foreground'
                        }
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What we're NOT building */}
      <section className="px-6 pb-32">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <span className="text-sm font-medium text-accent">Scope</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
              Read-only by design
            </h2>
            <p className="mt-3 text-muted-foreground">
              BiB is intentionally limited to surfacing data. Everything below is explicitly out of scope.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <ul className="space-y-3">
              {outOfScope.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive/70" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-32">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Ready to try it?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Point BiB at any site, describe what you want, and get a live dashboard in seconds.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/app">
              <Button size="lg" variant="accent">
                Launch App
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/">
              <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to home
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
