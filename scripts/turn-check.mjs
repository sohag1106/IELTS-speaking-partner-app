/**
 * TURN relay probe: loads GET /api/config in a real browser and verifies the
 * ICE servers actually gather a relay candidate — the lifeline when the two
 * peers sit behind different NATs (mobile data ↔ Wi-Fi).
 *
 * Usage: node scripts/turn-check.mjs   (dev server must be running)
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const APP = 'http://127.0.0.1:5173';
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

async function main() {
  const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!executablePath) {
    console.error('No Chrome/Edge found');
    process.exit(1);
  }
  try {
    const html = await (await fetch(APP)).text();
    if (!html.includes('IELTS')) {
      console.error(`A different app is serving at ${APP} — expected the IELTS dev server.`);
      process.exit(1);
    }
  } catch {
    console.error(`Dev server not reachable at ${APP} — start "npm run dev" first.`);
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--disable-dev-shm-usage', '--window-size=640,480'],
  });

  try {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`));
    await page.goto(APP, { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(async () => {
      const out = { relay: [], srflx: [], host: [], errors: [], iceServers: null, turnConfigured: false };
      let cfg;
      try {
        const r = await fetch('/api/config');
        cfg = await r.json();
        out.iceServers = (cfg.iceServers ?? []).map((s) => ({
          urls: s.urls,
          hasCreds: Boolean(s.username && s.credential),
        }));
        out.turnConfigured = (cfg.iceServers ?? []).some((s) =>
          (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/i.test(String(u))),
        );
      } catch (e) {
        out.fetchError = String(e);
        return out;
      }

      const pc = new RTCPeerConnection({ iceServers: cfg.iceServers ?? [] });
      pc.createDataChannel('turn-probe'); // triggers ICE gathering
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        // RTCIceCandidate.toJSON().type is undefined in some Chrome builds —
        // parse the candidate string instead.
        const s = e.candidate.candidate;
        if (s.includes(' typ relay ')) out.relay.push(s);
        else if (s.includes(' typ srflx ')) out.srflx.push(s);
        else out.host.push(s);
      };
      pc.onicecandidateerror = (e) => {
        out.errors.push({ code: e.errorCode, text: e.errorText, url: e.url });
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // Relay candidates land within a few seconds on a healthy TURN; dead
      // servers surface icecandidateerror (701) around the 5s timeout.
      await new Promise((r) => setTimeout(r, 10000));
      pc.close();
      return out;
    });

    console.log('config: GET /api/config');
    if (result.fetchError) {
      console.log(`  FAIL cannot fetch config: ${result.fetchError}`);
      process.exit(1);
    }
    for (const s of result.iceServers ?? []) {
      const urls = Array.isArray(s.urls) ? s.urls.join(' ') : s.urls;
      console.log(`  ${urls}${s.hasCreds ? ' (+creds)' : ''}`);
    }
    console.log('gathering (10s):');
    console.log(`  host  ${result.host.length}`);
    console.log(`  srflx ${result.srflx.length}`);
    console.log(`  relay ${result.relay.length}`);
    for (const err of result.errors) {
      console.log(`  error ${err.code} ${err.text} (${err.url})`);
    }

    if (!result.turnConfigured) {
      console.log(
        '\nFAILED — no TURN server in /api/config. Set CF_TURN_KEY_ID/CF_TURN_TOKEN (Cloudflare TURN) or TURN_URL in server/.env, then re-run.',
      );
      process.exit(1);
    }
    const ok = result.relay.length > 0;
    console.log(
      ok
        ? '\nALL PASSED — TURN relay candidates gather (mixed-NAT pairs can connect)'
        : '\nFAILED — TURN configured but no relay candidate gathered: mixed networks (data ↔ Wi-Fi) cannot connect',
    );
    process.exit(ok ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('turn check crashed:', err);
  process.exit(1);
});
