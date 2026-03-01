interface AgentLoaderProps {
  phases: string[]
  currentPhase: number
}

export function AgentLoader({ phases, currentPhase }: AgentLoaderProps) {
  const clamped = Math.min(currentPhase, phases.length - 1)

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative mb-10">
        <div className="h-24 w-24 rounded-full border border-accent/20 bg-accent/5">
          <div className="absolute inset-0 animate-ping rounded-full bg-accent/10" />
          <div className="absolute inset-2 animate-pulse rounded-full bg-accent/10" />
          <div className="absolute inset-4 rounded-full bg-accent/15" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="h-8 w-8 animate-spin text-accent"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        </div>

        <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
          <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-accent" />
        </div>
        <div className="absolute inset-0 animate-[spin_6s_linear_infinite_reverse]">
          <div className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent/60" />
        </div>
      </div>

      <div className="relative h-6 overflow-hidden">
        <p
          key={clamped}
          className="animate-[fadeSlideIn_0.5s_ease-out] font-mono text-sm text-accent"
        >
          {phases[clamped]}
        </p>
      </div>

      <div className="mt-6 flex items-center gap-1.5">
        {phases.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-500 ${
              i <= clamped ? 'w-6 bg-accent' : 'w-1 bg-border'
            }`}
          />
        ))}
      </div>

      <div className="mt-10 w-full max-w-md rounded-lg border border-border bg-card p-4 font-mono text-xs">
        <div className="flex flex-col gap-1.5">
          {phases.slice(0, clamped + 1).map((phase, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 ${
                i === clamped ? 'text-accent' : 'text-muted-foreground'
              }`}
            >
              <span className={i < clamped ? 'text-accent' : 'text-muted-foreground'}>
                {i < clamped ? '[done]' : '[....]'}
              </span>
              <span>{phase}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
