const steps = [
  {
    number: '01',
    title: 'Describe what you want',
    description:
      'Enter the URL of any website and describe the data you care about in natural language.',
  },
  {
    number: '02',
    title: 'Agent profiles the site',
    description:
      'A profiler agent visits the site, identifies the navigation flow, and builds a structured scrape plan.',
  },
  {
    number: '03',
    title: 'Agent scrapes the data',
    description:
      'A scraper agent follows the plan, navigates the site, and extracts your data as structured JSON.',
  },
  {
    number: '04',
    title: 'Dashboard is rendered',
    description:
      'BiB generates a clean, custom dashboard displaying your data with links back to the real site.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <span className="text-sm font-medium text-accent">How It Works</span>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            From prompt to dashboard
            <br />
            in seconds.
          </h2>
        </div>

        <div className="grid gap-0 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.number} className="relative flex flex-col items-center px-6 py-8 text-center">
              {index < steps.length - 1 && (
                <div className="absolute right-0 top-[4.5rem] hidden h-px w-full bg-border md:block" />
              )}

              <div className="relative z-10 mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card">
                <span className="font-mono text-sm font-bold text-accent">{step.number}</span>
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
