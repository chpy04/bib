import { useState } from "react";
import * as api from "@/lib/api";
import { AgentLoader } from "@/components/agent-loader";
import { TaskReviewPanel } from "@/components/TaskReviewPanel";
import type { TaskPlan, VerifiedTask } from "@/types";

const DATA_PHASES = [
  "Analyzing your request...",
  "Planning extraction tasks...",
  "Connecting to browser...",
  "Verifying tasks on site...",
  "Extracting sample data...",
];

const UI_PHASES = [
  "Reading verified tasks...",
  "Designing layout...",
  "Generating React component...",
];

interface SetupPanelProps {
  onComplete: (
    code: string,
    verifiedTasks: VerifiedTask[],
    layoutHint: string,
    profileId: string,
  ) => void;
}

export function SetupPanel({ onComplete }: SetupPanelProps) {
  const [step, setStep] = useState<"url" | "data" | "review" | "ui">("url");
  const [url, setUrl] = useState("");
  const [dataPrompt, setDataPrompt] = useState("");
  const [uiPrompt, setUiPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [verifiedTasks, setVerifiedTasks] = useState<VerifiedTask[]>([]);
  const [loaderPhase, setLoaderPhase] = useState(0);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const { profile_id } = await api.startAuth(url.trim());
      setProfileId(profile_id);
      setStep("data");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open browser");
    } finally {
      setLoading(false);
    }
  }

  async function handleDataPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!dataPrompt.trim()) return;
    setError(null);
    setLoading(true);
    setLoaderPhase(0);

    try {
      setLoaderPhase(1);
      const plan: TaskPlan = await api.planTasks(url.trim(), dataPrompt.trim());

      setLoaderPhase(2);
      // Small delay so the user sees the phase transition
      await new Promise((r) => setTimeout(r, 300));

      setLoaderPhase(3);
      const { profile_id, verified_tasks: tasks } = await api.verifyTasks(
        url.trim(),
        plan.tasks,
        profileId,
      );

      setLoaderPhase(4);

      if (tasks.length === 0) {
        throw new Error(
          "No tasks could be verified. Try a more specific prompt.",
        );
      }

      setProfileId(profile_id);
      setVerifiedTasks(tasks);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoaderPhase(0);
    }
  }

  async function handleUIPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!uiPrompt.trim()) return;
    setError(null);
    setLoading(true);
    setLoaderPhase(0);

    try {
      setLoaderPhase(1);
      const { component_code } = await api.generateUI(
        verifiedTasks,
        uiPrompt.trim(),
        profileId,
        url.trim(),
        dataPrompt.trim(),
      );

      setLoaderPhase(2);
      onComplete(component_code, verifiedTasks, uiPrompt.trim(), profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoaderPhase(0);
    }
  }

  if (step === "url") {
    return (
      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Target website URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com"
            required
            autoFocus
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <div className="mt-2 flex gap-2">
            {[
              "https://console.aws.amazon.com",
              "https://github.com",
              "https://news.ycombinator.com",
            ].map((site) => (
              <button
                key={site}
                type="button"
                onClick={() => setUrl(site)}
                className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground hover:border-foreground/20"
              >
                {new URL(site).hostname.replace("www.", "")}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            A browser window will open so you can log in manually before the
            agent runs.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? "Opening browser…" : "Open browser to log in →"}
        </button>
      </form>
    );
  }

  if (step === "data") {
    if (loading) {
      return <AgentLoader phases={DATA_PHASES} currentPhase={loaderPhase} />;
    }

    return (
      <form onSubmit={handleDataPrompt} className="space-y-4">
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Browser opened at {url}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Log in if needed — the agent will use your session automatically.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            What data do you want to extract?
          </label>
          <textarea
            value={dataPrompt}
            onChange={(e) => setDataPrompt(e.target.value)}
            placeholder="Show me my open pull requests and top repositories…"
            rows={4}
            required
            autoFocus
            className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!dataPrompt.trim()}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          Plan & verify data →
        </button>
      </form>
    );
  }

  if (step === "review") {
    return (
      <TaskReviewPanel
        tasks={verifiedTasks}
        profileId={profileId}
        url={url}
        onContinue={(updatedTasks) => {
          setVerifiedTasks(updatedTasks);
          setStep("ui");
        }}
      />
    );
  }

  // step === "ui"
  if (loading) {
    return <AgentLoader phases={UI_PHASES} currentPhase={loaderPhase} />;
  }

  return (
    <form onSubmit={handleUIPrompt} className="space-y-4">
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          {verifiedTasks.length} task(s) verified
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Now describe how the dashboard should look.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          How should the dashboard look?
        </label>
        <textarea
          value={uiPrompt}
          onChange={(e) => setUiPrompt(e.target.value)}
          placeholder="Two-column layout with cards for repos and a table for PRs…"
          rows={4}
          required
          autoFocus
          className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!uiPrompt.trim()}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
      >
        Generate dashboard →
      </button>
    </form>
  );
}
