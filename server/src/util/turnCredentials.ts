import { env } from '../env.js';

/**
 * Short-lived TURN credentials for GET /api/config.
 *
 * Two sources, both optional:
 *  - Cloudflare TURN (recommended): CF_TURN_KEY_ID + CF_TURN_TOKEN are exchanged
 *    for time-limited credentials (1 h, refreshed at 45 min). The tokens stay on
 *    the server; browsers only ever see the temporary TURN username/credential.
 *  - Static TURN: TURN_URL (+ TURN_USERNAME/TURN_CREDENTIAL) for coturn or any
 *    hosted TURN with fixed credentials.
 *
 * Without either, /api/config serves STUN only — same-Wi-Fi pairs still
 * connect, but different networks (mobile data ↔ Wi-Fi) cannot.
 */

interface IceServerEntry {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const TTL_SECONDS = 3600; // credentials we request from Cloudflare
const REFRESH_AT = 0.75; // renew at 45 min, so clients always get ≥15 min of validity
const FETCH_TIMEOUT_MS = 4000;
const RETRY_MS = 30_000; // back off after a failed refresh

let cached: IceServerEntry[] | null = null;
let expiresAt = 0; // when the cached credentials stop working
let refreshAt = 0; // when to fetch a fresh set
let retryAt = 0; // after a failure, wait before hammering the API
let inflight: Promise<IceServerEntry[] | null> | null = null;

function cfConfigured(): boolean {
  return Boolean(env.cfTurnKeyId && env.cfTurnToken);
}

/** Accept {iceServers:[...]} or {iceServers:{...}}; keep only usable entries. */
function normalizeIceServers(raw: unknown): IceServerEntry[] {
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Record<string, unknown>[];
  const out: IceServerEntry[] = [];
  for (const s of list) {
    const urlsRaw = s?.urls;
    const urls = (typeof urlsRaw === 'string' ? [urlsRaw] : Array.isArray(urlsRaw) ? urlsRaw : [])
      .filter((u): u is string => typeof u === 'string')
      // Browsers block/burst port 53, so drop it (Cloudflare's list includes it).
      .filter((u) => /^(turns?|stun):/i.test(u) && !/:53(\?|$)/.test(u));
    if (urls.length === 0) continue;
    const entry: IceServerEntry = { urls };
    if (typeof s.username === 'string') entry.username = s.username;
    if (typeof s.credential === 'string') entry.credential = s.credential;
    out.push(entry);
  }
  return out;
}

async function fetchCloudflare(): Promise<IceServerEntry[] | null> {
  // Two endpoint names: the current one and the legacy fallback (same request).
  let last = '';
  for (const path of ['generate-ice-servers', 'generate']) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${env.cfTurnKeyId}/credentials/${path}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.cfTurnToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl: TTL_SECONDS }),
          signal: ctrl.signal,
        },
      );
      if (!res.ok) {
        last = `${path}: HTTP ${res.status}`;
        continue;
      }
      const data = (await res.json()) as { iceServers?: unknown };
      const servers = normalizeIceServers(data.iceServers);
      if (servers.some((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/i.test(u)))) {
        return servers;
      }
      last = `${path}: response contained no TURN entries`;
    } catch (err) {
      last = `${path}: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      clearTimeout(timer);
    }
  }
  console.warn('[turn] Cloudflare credential fetch failed:', last);
  return null;
}

function refresh(): Promise<IceServerEntry[] | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    const fresh = await fetchCloudflare();
    if (fresh) {
      cached = fresh;
      const now = Date.now();
      refreshAt = now + TTL_SECONDS * 1000 * REFRESH_AT;
      expiresAt = now + TTL_SECONDS * 1000;
    } else {
      retryAt = Date.now() + RETRY_MS;
      if (!cached) refreshAt = 0; // no usable cache — allow another attempt after backoff
    }
    return cached;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** TURN entries for the ICE config; empty when nothing is configured. */
export async function getTurnIceServers(): Promise<IceServerEntry[]> {
  const out: IceServerEntry[] = [];
  if (cfConfigured()) {
    const now = Date.now();
    if (!cached || (now >= refreshAt && now >= retryAt)) {
      // A failure here resolves to the existing cache (or null); never throws.
      await refresh();
    }
    if (cached) out.push(...cached);
  }
  if (env.turnUrl) {
    const entry: IceServerEntry = { urls: env.turnUrl };
    if (env.turnUsername) entry.username = env.turnUsername;
    if (env.turnCredential) entry.credential = env.turnCredential;
    out.push(entry);
  }
  return out;
}

/** When the served credentials stop working (0 = static / no expiry known). */
export function getTurnExpiresAt(): number {
  return cfConfigured() ? expiresAt : 0;
}

// Warm the cache at boot so the first visitor doesn't pay the fetch latency.
if (cfConfigured()) void refresh();
