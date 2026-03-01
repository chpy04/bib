import { useEffect, useState } from 'react'
import { Plus, Globe } from 'lucide-react'
import * as api from '@/lib/api'
import type { ProfileSummary } from '@/types'

interface ProfileGridProps {
  onSelectProfile: (id: string) => void
  onNewProfile: () => void
}

export function ProfileGrid({ onSelectProfile, onNewProfile }: ProfileGridProps) {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listProfiles()
      .then(setProfiles)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Loading profiles…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <button
        onClick={onNewProfile}
        className="rounded-xl border-2 border-dashed border-border bg-card/50 p-6 text-left transition hover:border-accent hover:bg-card flex flex-col items-center justify-center gap-2 min-h-[140px]"
      >
        <Plus className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">New profile</span>
      </button>

      {profiles.map((profile) => (
        <button
          key={profile.id}
          onClick={() => onSelectProfile(profile.id)}
          className="rounded-xl border border-border bg-card p-6 text-left transition hover:border-accent hover:shadow-sm flex flex-col gap-3 min-h-[140px]"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <Globe className="h-4 w-4 text-accent" />
            </div>
            <span className="text-sm font-semibold text-foreground truncate">
              {profile.site_name || 'Unknown site'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {profile.tool_count} tool{profile.tool_count !== 1 ? 's' : ''}
          </p>
        </button>
      ))}
    </div>
  )
}
