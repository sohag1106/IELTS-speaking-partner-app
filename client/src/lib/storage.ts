export interface Identity {
  userId: string;
  nickname: string;
  token: string;
}

const KEY = 'ielts.identity';

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Identity;
    if (!parsed.token || !parsed.userId || !parsed.nickname) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveIdentity(id: Identity): void {
  localStorage.setItem(KEY, JSON.stringify(id));
}

export function clearIdentity(): void {
  localStorage.removeItem(KEY);
}
