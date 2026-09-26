import { loadEnvFile } from 'node:process';

try {
  loadEnvFile();
} catch {
  // .env is optional locally; defaults below apply.
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: int('PORT', 3001),
  databaseUrl: process.env.DATABASE_URL ?? '',
  part2PrepSeconds: int('PART2_PREP_SECONDS', 60),
  part2TalkSeconds: int('PART2_TALK_SECONDS', 120),
  stunUrl: process.env.STUN_URL ?? 'stun:stun.l.google.com:19302',
  turnUrl: process.env.TURN_URL ?? 'turn:openrelay.metered.ca:80',
  turnUsername: process.env.TURN_USERNAME ?? 'openrelayproject',
  turnCredential: process.env.TURN_CREDENTIAL ?? 'openrelayproject',
};

if (!env.databaseUrl) {
  console.warn('[env] DATABASE_URL is not set — DB routes will fail until server/.env is configured.');
}
