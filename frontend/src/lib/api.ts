import type { Profile, CreateProfileResponse, ComponentResponse } from '../types';

const API_BASE = '/api';
const WS_BASE = `ws://${window.location.hostname}:8000`;

export async function fetchProfiles(): Promise<Profile[]> {
  const res = await fetch(`${API_BASE}/profiles`);
  return res.json();
}

export async function createProfile(url: string, request: string): Promise<CreateProfileResponse> {
  const res = await fetch(`${API_BASE}/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, request }),
  });
  return res.json();
}

export async function getProfile(profileId: string): Promise<Profile> {
  const res = await fetch(`${API_BASE}/profiles/${profileId}`);
  return res.json();
}

export async function getComponent(profileId: string): Promise<ComponentResponse> {
  const res = await fetch(`${API_BASE}/profiles/${profileId}/component`);
  return res.json();
}

export function getWsUrl(profileId: string): string {
  return `${WS_BASE}/ws/${profileId}`;
}
