import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { Features } from '@/components/features'
import { HowItWorks } from '@/components/how-it-works'
import { Footer } from '@/components/footer'

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-border" />
      </div>
      <Features />
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-border" />
      </div>
      <HowItWorks />
      <Footer />
    </main>
  )
}
