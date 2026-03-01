export type Phase = 'auth' | 'prompt' | 'planning' | 'verifying' | 'reviewed' | 'generating' | 'display';

export interface Task {
  id: string;
  description: string;
  output_schema: Record<string, unknown>;
  display_hint: string;
  type: 'data' | 'action';
}

export interface TaskPlan {
  tasks: Task[];
  layout_hint: string;
}

export interface VerifiedTask extends Task {
  instructions: string;
  sample_output: unknown;
}

export interface Instruction {
  name: string;
  description: string;
  instructions: string;
  output_schema: Record<string, unknown>;
  sample_output: unknown;
  display_hint: string;
  type: 'data' | 'action';
}

export interface ProfileSummary {
  id: string;
  url: string;
  site_name: string;
  created_at: string;
  tool_count: number;
}

export interface ProfileDetail extends ProfileSummary {
  tools: Instruction[];
}

export interface DashboardSummary {
  profile_id: string;
  name: string;
  url: string;
  prompt: string;
  created_at: string;
}

export interface DashboardDetail extends DashboardSummary {
  component_code: string;
  verified_tasks: VerifiedTask[];
  layout_hint: string;
  chat_history: string[];
}
