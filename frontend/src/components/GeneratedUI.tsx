import { useEffect, useRef, useState } from "react";
import { IFRAME_SHELL } from "@/lib/iframe-shell";
import { AgentLoader } from "@/components/agent-loader";
import * as api from "@/lib/api";
import type { VerifiedTask } from "@/types";

const REFINE_PHASES = [
  "Reading current component...",
  "Applying changes...",
  "Generating updated component...",
];

interface GeneratedUIProps {
  componentCode: string;
  verifiedTasks: VerifiedTask[];
  layoutHint: string;
  chatHistory: string[];
  onCodeUpdate: (newCode: string, refinementMessage: string) => void;
  profileId: string;
}

export function GeneratedUI({
  componentCode,
  verifiedTasks,
  layoutHint,
  chatHistory,
  onCodeUpdate,
  profileId,
}: GeneratedUIProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const shellWrittenRef = useRef(false);
  const [shellReady, setShellReady] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(window.innerHeight - 200);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refinement, setRefinement] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [refinePhase, setRefinePhase] = useState(0);

  // Write the shell HTML into the iframe once on mount
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || shellWrittenRef.current) return;
    shellWrittenRef.current = true;

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(IFRAME_SHELL);
    doc.close();
  }, []);

  // Listen for postMessage events from the iframe
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data;
      if (!msg?.type) return;

      switch (msg.type) {
        case "SHELL_READY":
          setShellReady(true);
          break;

        case "RESIZE":
          if (typeof msg.height === "number" && msg.height > 50) {
            setIframeHeight(msg.height + 40);
          }
          break;

        case "NAVIGATE":
          if (msg.url) window.open(msg.url, "_blank", "noopener,noreferrer");
          break;

        case "ACTION":
          if (msg.name) handleAction(msg.name);
          break;
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedTasks]);

  // When shell is ready or component code changes, send it to the iframe
  useEffect(() => {
    if (!shellReady || !componentCode) return;

    // Render with cached data, then load from cache (no agent re-scrape)
    const initialData = buildDataMap(verifiedTasks, (t) => t.sample_output);
    postToIframe({ type: "RENDER", code: componentCode, data: initialData });

    fetchAllData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellReady, componentCode]);

  function postToIframe(message: object) {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }

  function buildDataMap(
    tasks: VerifiedTask[],
    getValue: (t: VerifiedTask) => unknown,
  ): Record<string, unknown> {
    return Object.fromEntries(
      tasks.filter((t) => t.type === "data").map((t) => [t.id, getValue(t)]),
    );
  }

  async function fetchAllData(refresh: boolean) {
    setFetchError(null);
    if (refresh) setRefreshing(true);

    const dataTasks = verifiedTasks.filter((t) => t.type === "data");
    if (dataTasks.length === 0) {
      setRefreshing(false);
      return;
    }

    try {
      const results = await Promise.allSettled(
        dataTasks.map((t) => api.getData(t.id, profileId, refresh)),
      );

      const freshData: Record<string, unknown> = {};
      results.forEach((result, i) => {
        const task = dataTasks[i];
        if (!task) return;
        if (result.status === "fulfilled" && result.value?.success) {
          freshData[task.id] = result.value.data;
        } else if (result.status === "rejected") {
          setFetchError(`Failed to fetch ${task.id}: ${result.reason?.message}`);
        }
      });

      if (Object.keys(freshData).length > 0) {
        postToIframe({ type: "DATA_UPDATE", data: freshData });
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAction(instructionName: string) {
    try {
      const result = await api.executeAction(instructionName, profileId);
      if (
        result.success &&
        result.data &&
        Object.keys(result.data).length > 0
      ) {
        postToIframe({ type: "DATA_UPDATE", data: result.data });
      }
    } catch (err) {
      console.error("[GeneratedUI] Action failed:", err);
    }
  }

  async function handleRefine(e: React.FormEvent) {
    e.preventDefault();
    const message = refinement.trim();
    if (!message) return;

    setRefining(true);
    setRefineError(null);
    setRefinePhase(0);

    try {
      setRefinePhase(1);
      const { component_code } = await api.refineUI(
        verifiedTasks,
        layoutHint,
        componentCode,
        chatHistory,
        message,
        profileId,
      );
      setRefinePhase(2);
      setRefinement("");
      onCodeUpdate(component_code, message);
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefining(false);
      setRefinePhase(0);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => fetchAllData(true)}
          disabled={refreshing}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <iframe
        ref={iframeRef}
        title="Generated dashboard"
        style={{ height: `${iframeHeight}px`, minHeight: 'calc(100vh - 200px)' }}
        className="w-full rounded-xl border border-border bg-white transition-all duration-200"
        sandbox="allow-scripts allow-same-origin"
      />
      {fetchError && (
        <p className="mt-2 text-xs text-destructive">{fetchError}</p>
      )}

      {refining ? (
        <div className="mt-4">
          <AgentLoader phases={REFINE_PHASES} currentPhase={refinePhase} />
        </div>
      ) : (
        <>
          <form onSubmit={handleRefine} className="mt-4 flex gap-2">
            <input
              type="text"
              value={refinement}
              onChange={(e) => setRefinement(e.target.value)}
              placeholder="Request changes to the UI..."
              className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="submit"
              disabled={!refinement.trim()}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
            >
              Refine
            </button>
          </form>
          {refineError && (
            <p className="mt-2 text-xs text-destructive">{refineError}</p>
          )}
        </>
      )}
    </div>
  );
}
