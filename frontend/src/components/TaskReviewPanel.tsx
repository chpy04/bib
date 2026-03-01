import { useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import * as api from "@/lib/api";
import type { VerifiedTask } from "@/types";

interface TaskReviewPanelProps {
  tasks: VerifiedTask[];
  profileId: string;
  url: string;
  onContinue: (tasks: VerifiedTask[]) => void;
}

export function TaskReviewPanel({
  tasks: initialTasks,
  profileId,
  url,
  onContinue,
}: TaskReviewPanelProps) {
  const [tasks, setTasks] = useState<VerifiedTask[]>(initialTasks);
  const [newPrompt, setNewPrompt] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newPrompt.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const result = await api.addTool(profileId, newPrompt.trim());
      const newTask: VerifiedTask = {
        id: result.id,
        description: result.description,
        instructions: result.instructions,
        output_schema: result.output_schema,
        sample_output: result.sample_output,
        display_hint: result.display_hint,
        type: result.type,
      };
      setTasks((prev) => [...prev, newTask]);
      setNewPrompt("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setAdding(false);
    }
  }

  function handleRerun(taskId: string, newData: unknown) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, sample_output: newData } : t,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          {tasks.length} task(s) verified
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Review collected data, re-run tasks, or add new ones before designing
          your dashboard.
        </p>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            profileId={profileId}
            url={url}
            onRerun={handleRerun}
          />
        ))}
      </div>

      <form onSubmit={handleAddTask} className="flex gap-2">
        <input
          type="text"
          value={newPrompt}
          onChange={(e) => setNewPrompt(e.target.value)}
          placeholder="Add another task…"
          disabled={adding}
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={adding || !newPrompt.trim()}
          className="flex items-center justify-center rounded-lg bg-accent px-3 py-2.5 text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
      {addError && <p className="text-xs text-destructive">{addError}</p>}

      <button
        onClick={() => onContinue(tasks)}
        disabled={tasks.length === 0}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50 disabled:pointer-events-none"
      >
        Design dashboard layout →
      </button>
    </div>
  );
}

function TaskCard({
  task,
  profileId,
  url,
  onRerun,
}: {
  task: VerifiedTask;
  profileId: string;
  url: string;
  onRerun: (taskId: string, newData: unknown) => void;
}) {
  const [liveData, setLiveData] = useState<unknown>(task.sample_output);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const [justRefreshed, setJustRefreshed] = useState(false);

  async function handleRerun() {
    setRerunning(true);
    setRerunError(null);
    setJustRefreshed(false);
    try {
      // Re-verify the task using the same pipeline that originally created it
      const baseTask = {
        id: task.id,
        description: task.description,
        output_schema: task.output_schema,
        display_hint: task.display_hint,
        type: task.type,
      };
      const { verified_tasks } = await api.verifyTasks(
        url,
        [baseTask],
        profileId,
      );
      const fresh = verified_tasks[0];
      if (fresh) {
        setLiveData(fresh.sample_output);
        onRerun(task.id, fresh.sample_output);
        setJustRefreshed(true);
        setTimeout(() => setJustRefreshed(false), 2000);
      } else {
        setRerunError("Task verification returned no results");
      }
    } catch (err) {
      setRerunError(err instanceof Error ? err.message : "Re-run failed");
    } finally {
      setRerunning(false);
    }
  }

  return (
    <div
      className={`rounded-xl border bg-card p-5 space-y-3 transition-colors ${
        justRefreshed
          ? "border-green-500/50"
          : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {task.description}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
              {task.type}
            </span>
            {task.display_hint && (
              <span className="text-xs text-muted-foreground">
                {task.display_hint}
              </span>
            )}
            {rerunning && (
              <span className="text-xs text-accent">Re-running…</span>
            )}
            {justRefreshed && (
              <span className="text-xs text-green-600 dark:text-green-400">
                Updated
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleRerun}
          disabled={rerunning}
          title="Re-run this task"
          className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full border border-border text-muted-foreground transition hover:text-foreground hover:border-foreground/30 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${rerunning ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      <SchemaTable schema={task.output_schema} />

      {liveData != null && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition select-none">
            Sample data
          </summary>
          <pre className="mt-2 rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap">
            {JSON.stringify(liveData, null, 2)}
          </pre>
        </details>
      )}

      {rerunError && <p className="text-xs text-destructive">{rerunError}</p>}
    </div>
  );
}

function SchemaTable({ schema }: { schema: Record<string, unknown> }) {
  const properties = extractProperties(schema);
  if (properties.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/30">
            <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">
              Field
            </th>
            <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">
              Type
            </th>
          </tr>
        </thead>
        <tbody>
          {properties.map(({ name, type }) => (
            <tr key={name} className="border-t border-border/40">
              <td className="px-3 py-1.5 font-mono text-foreground">{name}</td>
              <td className="px-3 py-1.5">
                <span className="inline-block rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                  {type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function extractProperties(
  schema: Record<string, unknown>,
): { name: string; type: string }[] {
  // Handle JSON Schema with "properties"
  const props = schema.properties as Record<string, unknown> | undefined;
  if (props && typeof props === "object") {
    return Object.entries(props).map(([name, def]) => {
      const fieldDef = def as Record<string, unknown>;
      let type = (fieldDef.type as string) ?? "unknown";

      // Handle array types
      if (type === "array" && fieldDef.items) {
        const items = fieldDef.items as Record<string, unknown>;
        if (items.type) {
          type = `${items.type as string}[]`;
        } else {
          type = "array";
        }
      }

      return { name, type };
    });
  }

  // Handle items.properties for array-of-objects schemas
  const items = schema.items as Record<string, unknown> | undefined;
  if (items && typeof items === "object") {
    return extractProperties(items);
  }

  // Fallback: treat top-level keys as field names
  return Object.entries(schema)
    .filter(([k]) => k !== "type" && k !== "description" && k !== "title")
    .map(([name, val]) => ({
      name,
      type: typeof val === "string" ? val : "unknown",
    }));
}
