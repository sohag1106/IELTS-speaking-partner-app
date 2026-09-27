import type { Identity } from './storage';

export interface ReceivedScore {
  band: number;
  examinerNickname: string;
  createdAt: string;
  roundNumber: number;
}

export interface GivenScore {
  band: number;
  examineeNickname: string;
  createdAt: string;
}

export interface Profile {
  userId: string;
  nickname: string;
  stats: { count: number; avgBand: number | null };
  received: ReceivedScore[];
  given: GivenScore[];
}

export interface IceConfig {
  iceServers: RTCIceServer[];
  /** Epoch ms when TURN credentials stop working (0/absent = no expiry). */
  turnExpiresAt?: number;
  part2: { prepSeconds: number; talkSeconds: number };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return body;
}

export async function guestLogin(nickname: string): Promise<Identity> {
  return request<Identity>('/api/auth/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function fetchProfile(token: string): Promise<Profile> {
  return request<Profile>('/api/me', { headers: authHeaders(token) });
}

export function fetchIceConfig(): Promise<IceConfig> {
  return request<IceConfig>('/api/config');
}
