import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent">
            <span className="text-xs font-bold text-accent-foreground">B</span>
          </div>
          <span className="text-sm font-semibold text-foreground">BiB</span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/#features" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            Features
          </Link>
          <Link to="/#how-it-works" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            How It Works
          </Link>
          <Link to="/app" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            Launch App
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">Built for the hackathon.</p>
      </div>
    </footer>
  )
}
