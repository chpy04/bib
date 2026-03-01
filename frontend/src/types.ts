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
