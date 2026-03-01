import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <img src="/logo.svg" alt="BiB" className="h-10 w-auto" />
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
