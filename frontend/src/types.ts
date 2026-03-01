export type TaskType = 'DATA_READ' | 'ACTION';

export interface OutputSchema {
  fields: Record<string, string>;
  is_list: boolean;
  sample_data: unknown;
}

export interface TaskProfile {
  name: string;
  type: TaskType;
  description: string;
  agent_prompt: string;
  input_params: string[] | null;
  output_schema: OutputSchema;
}

export interface Profile {
  profile_id: string;
  base_url: string;
  name: string;
  description: string;
  tasks: TaskProfile[];
  auth_configured: boolean;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'running';

export interface WSMessage {
  type: string;
  data?: Record<string, unknown>;
  status?: ConnectionStatus;
}
