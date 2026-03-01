export interface Profile {
  profile_id: string;
  url: string;
  name: string;
  description: string;
  component_code: string | null;
}

export interface CreateProfileResponse {
  profile_id: string;
  status: string;
}

export interface ComponentResponse {
  component_code: string | null;
  status: string;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'running';

export interface WSMessage {
  type: string;
  data?: Record<string, unknown>;
  status?: ConnectionStatus;
}
