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
  // Static TURN (coturn, hosted TURN, ...). Empty by default: the old public
  // Open Relay is dead, and shipping a broken entry only masks real failures.
  turnUrl: process.env.TURN_URL ?? '',
  turnUsername: process.env.TURN_USERNAME ?? '',
  turnCredential: process.env.TURN_CREDENTIAL ?? '',
  // Cloudflare TURN (recommended): dash.cloudflare.com → Realtime → TURN
  // Server → Create. The server exchanges these for short-lived credentials.
  cfTurnKeyId: process.env.CF_TURN_KEY_ID ?? '',
  cfTurnToken: process.env.CF_TURN_TOKEN ?? '',
};

if (!env.databaseUrl) {
  console.warn('[env] DATABASE_URL is not set — DB routes will fail until server/.env is configured.');
}
if (!env.cfTurnKeyId && !env.turnUrl) {
  console.warn(
    '[env] No TURN configured — pairs on different networks (mobile data ↔ Wi-Fi) cannot connect. Set CF_TURN_KEY_ID/CF_TURN_TOKEN (Cloudflare TURN) or TURN_URL.',
  );
}
