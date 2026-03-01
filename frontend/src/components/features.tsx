import { Globe, MessageSquare, LayoutDashboard, Link2 } from 'lucide-react'

const features = [
  {
    icon: MessageSquare,
    title: 'Natural Language Input',
    description:
      'Just describe what you want to see. No selectors, no code, no configuration. Tell BiB in plain English.',
  },
  {
    icon: Globe,
    title: 'AI Browser Agent',
    description:
      'A Browser Use agent navigates the real website, handles complex page structures, and extracts exactly the data you asked for.',
  },
  {
    icon: LayoutDashboard,
    title: 'Custom Dashboard',
    description:
      'Your scraped data is rendered into a clean, purpose-built page with structured sections and direct links back to the source.',
  },
  {
    icon: Link2,
    title: 'Read-Only & Linked',
    description:
      'BiB is read-only by design. Every item links back to the real site so you can take action when you need to.',
  },
]

export function Features() {
  return (
    <section id="features" className="relative px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <span className="text-sm font-medium text-accent">Features</span>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Everything you need,
            <br />
            nothing you don&apos;t.
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border bg-card p-8 transition-colors hover:border-accent/30"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <feature.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
