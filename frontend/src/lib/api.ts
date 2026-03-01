import type { Profile } from '../types';

const API_BASE = '/api';
const WS_PROTO = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_BASE = `${WS_PROTO}//${window.location.host}`;

export async function fetchProfiles(): Promise<Profile[]> {
  const res = await fetch(`${API_BASE}/profiles`);
  return res.json();
}

export async function createProfile(url: string, request: string): Promise<Profile> {
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

export function getWsUrl(profileId: string): string {
  return `${WS_BASE}/ws/${profileId}`;
}
