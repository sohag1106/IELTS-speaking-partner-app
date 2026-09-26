import { fetchIceConfig } from './api';

/**
 * Cached RTCConfiguration from GET /api/config.
 * Falls back to a public STUN server when the endpoint is unreachable so a
 * config blip can never take down an otherwise healthy peer connection.
 */
let cached: RTCConfiguration | null = null;
let inflight: Promise<RTCConfiguration> | null = null;

export async function getIceConfig(): Promise<RTCConfiguration> {
  if (cached) return cached;
  if (!inflight) {
    inflight = (async () => {
      try {
        const cfg = await fetchIceConfig();
        cached = { iceServers: cfg.iceServers };
      } catch {
        cached = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      } finally {
        inflight = null;
      }
      return cached!;
    })();
  }
  return inflight;
}
