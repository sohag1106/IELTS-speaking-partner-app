import { fetchIceConfig } from './api';

/**
 * Cached RTCConfiguration from GET /api/config.
 * Falls back to a public STUN server when the endpoint is unreachable so a
 * config blip can never take down an otherwise healthy peer connection.
 *
 * TURN credentials are short-lived (Cloudflare issues ~1 h keys); when the
 * cached set is close to expiring, the next request refetches so a tab left
 * open overnight still starts fresh matches with working relay credentials.
 */
let cached: RTCConfiguration | null = null;
let cachedTurnExpiresAt = 0;
let inflight: Promise<RTCConfiguration> | null = null;

const TURN_RENEW_MARGIN_MS = 60_000; // refetch a minute before credentials die

function turnStale(): boolean {
  return cachedTurnExpiresAt > 0 && Date.now() >= cachedTurnExpiresAt - TURN_RENEW_MARGIN_MS;
}

export async function getIceConfig(): Promise<RTCConfiguration> {
  if (cached && !turnStale()) return cached;
  if (!inflight) {
    inflight = (async () => {
      try {
        const cfg = await fetchIceConfig();
        cached = { iceServers: cfg.iceServers };
        cachedTurnExpiresAt = cfg.turnExpiresAt ?? 0;
      } catch {
        // Keep an existing (possibly slightly stale) config over a STUN-only
        // downgrade — and leave cachedTurnExpiresAt untouched so the next
        // call retries the refetch.
        if (!cached) {
          cached = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
          cachedTurnExpiresAt = 0;
        }
      } finally {
        inflight = null;
      }
      return cached!;
    })();
  }
  return inflight;
}
