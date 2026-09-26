/**
 * Server-clock offset estimation.
 *
 * The server is authoritative for Part 2 timing: it sends `endsAt` in its own
 * epoch ms. This module estimates `serverTime - clientTime` from timer:ping /
 * timer:pong round-trips so countdowns render correctly even when the device
 * clock is skewed (plan verification step 4).
 */

let offsetMs = 0; // server − client, smoothed
let samples = 0;

/** Feed one ping/pong exchange. `clientTime` is what we sent, `serverTime` what it replied, `receivedAt` local clock on receipt. */
export function notePong(clientTime: number, serverTime: number, receivedAt: number): void {
  const rtt = receivedAt - clientTime;
  if (!Number.isFinite(rtt) || rtt < 0 || rtt > 10_000) return; // bogus / clock jumped
  const estimate = serverTime + rtt / 2 - clientTime;
  // EWMA so one bad sample can't yank the countdown.
  offsetMs = samples === 0 ? estimate : offsetMs * 0.7 + estimate * 0.3;
  samples++;
}

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function clockOffsetMs(): number {
  return offsetMs;
}
