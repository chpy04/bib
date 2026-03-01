import type { TaskPlan, Task, VerifiedTask, Instruction } from '../types';

const API = '/api';

async function _post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || res.statusText || 'Request failed');
  return data as T;
}

async function _get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || res.statusText || 'Request failed');
  return data as T;
}

export async function startAuth(url: string): Promise<{ status: string; message: string }> {
  return _post('/auth', { url });
}

export async function stopAuth(): Promise<void> {
  await fetch(`${API}/auth`, { method: 'DELETE' });
}

export async function authStatus(): Promise<{ active: boolean; url: string }> {
  return _get('/auth');
}

export async function planTasks(url: string, prompt: string): Promise<TaskPlan> {
  return _post('/plan', { url, prompt });
}

export async function verifyTasks(url: string, tasks: Task[]): Promise<VerifiedTask[]> {
  return _post('/verify', { url, tasks });
}

export async function generateUI(
  verified_tasks: VerifiedTask[],
  layout_hint: string,
): Promise<{ component_code: string }> {
  return _post('/generate', { verified_tasks, layout_hint });
}

export async function getData(name: string): Promise<{ instruction_name: string; data: unknown; success: boolean }> {
  return _get(`/data/${encodeURIComponent(name)}`);
}

export async function executeAction(
  name: string,
): Promise<{ success: boolean; data: Record<string, unknown> }> {
  return _post(`/action/${encodeURIComponent(name)}`, {});
}

export async function listInstructions(): Promise<Instruction[]> {
  return _get('/instructions');
}
