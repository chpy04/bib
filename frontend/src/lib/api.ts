import type {
  TaskPlan,
  Task,
  VerifiedTask,
  Instruction,
  ProfileSummary,
  ProfileDetail,
  DashboardSummary,
  DashboardDetail,
} from "../types";

const API = "/api";

async function _post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data?.detail || res.statusText || "Request failed");
  return data as T;
}

async function _get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data?.detail || res.statusText || "Request failed");
  return data as T;
}

export async function startAuth(
  url: string,
): Promise<{ status: string; message: string; profile_id: string }> {
  return _post("/auth", { url });
}

export async function stopAuth(): Promise<void> {
  await fetch(`${API}/auth`, { method: "DELETE" });
}

export async function authStatus(): Promise<{ active: boolean; url: string }> {
  return _get("/auth");
}

export async function planTasks(
  url: string,
  prompt: string,
): Promise<TaskPlan> {
  return _post("/plan", { url, prompt });
}

export async function verifyTasks(
  url: string,
  tasks: Task[],
  profile_id: string,
): Promise<{ profile_id: string; verified_tasks: VerifiedTask[] }> {
  return _post("/verify", { url, tasks, profile_id });
}

export async function generateUI(
  verified_tasks: VerifiedTask[],
  layout_hint: string,
  profile_id: string,
  url: string,
  prompt: string,
): Promise<{ component_code: string }> {
  return _post("/generate", {
    verified_tasks,
    layout_hint,
    profile_id,
    url,
    prompt,
  });
}

export async function refineUI(
  verified_tasks: VerifiedTask[],
  layout_hint: string,
  current_code: string,
  chat_history: string[],
  refinement: string,
  profile_id: string,
): Promise<{ component_code: string }> {
  return _post("/refine", {
    verified_tasks,
    layout_hint,
    current_code,
    chat_history,
    refinement,
    profile_id,
  });
}

export async function getData(
  name: string,
  profileId: string,
): Promise<{ instruction_name: string; data: unknown; success: boolean }> {
  return _get(
    `/data/${encodeURIComponent(name)}?profile_id=${encodeURIComponent(profileId)}`,
  );
}

export async function executeAction(
  name: string,
  profileId: string,
): Promise<{ success: boolean; data: Record<string, unknown> }> {
  return _post(
    `/action/${encodeURIComponent(name)}?profile_id=${encodeURIComponent(profileId)}`,
    {},
  );
}

export async function listInstructions(
  profileId: string,
): Promise<Instruction[]> {
  return _get(`/instructions?profile_id=${encodeURIComponent(profileId)}`);
}

export async function listProfiles(): Promise<ProfileSummary[]> {
  return _get("/profiles");
}

export async function getProfile(profileId: string): Promise<ProfileDetail> {
  return _get(`/profiles/${encodeURIComponent(profileId)}`);
}

export async function addTool(
  profileId: string,
  prompt: string,
): Promise<VerifiedTask> {
  return _post(`/profiles/${encodeURIComponent(profileId)}/tools`, { prompt });
}

export async function listDashboards(): Promise<DashboardSummary[]> {
  return _get("/dashboards");
}

export async function getDashboard(
  profileId: string,
): Promise<DashboardDetail> {
  return _get(`/dashboards/${encodeURIComponent(profileId)}`);
}
