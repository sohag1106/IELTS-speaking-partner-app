/**
 * Two-page end-to-end A/V check with fake media devices.
 * Verifies: match → auto camera/mic on join → WebRTC negotiation → connected
 * chip → remote frames decoding, in a real browser (Chrome/Edge headless).
 *
 * Usage: node scripts/webrtc-check.mjs   (dev server must be running)
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

// Pin to IPv4: another project's dev server can squat [::1]:5173, and
// "localhost" resolves there first, which serves the wrong app.
const APP = 'http://127.0.0.1:5173';
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

let failures = 0;

function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function clickButton(page, text) {
  const found = await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));
    if (!btn) return false;
    btn.click();
    return true;
  }, text);
  if (!found) throw new Error(`button not found: "${text}"`);
}

async function waitForButton(page, text, timeoutMs = 15000) {
  await page.waitForFunction(
    (t) => [...document.querySelectorAll('button')].some((b) => b.textContent.includes(t) && !b.disabled),
    { timeout: timeoutMs },
    text,
  );
}

async function waitForText(page, text, timeoutMs = 15000) {
  await page.waitForFunction((t) => document.body.textContent.includes(t), { timeout: timeoutMs }, text);
}

/** Drive one full exam round from the examiner's side (timers skipped via Hide). */
async function driveRound(examiner) {
  try {
    await waitForButton(examiner, 'Start Part 1');
    await clickButton(examiner, 'Start Part 1');
    await waitForButton(examiner, 'choose a cue card');
    await clickButton(examiner, 'choose a cue card');
    await waitForButton(examiner, 'Start this card');
    await clickButton(examiner, 'Start this card');
    await waitForButton(examiner, 'Hide card now');
    await clickButton(examiner, 'Hide card now');
    await waitForButton(examiner, 'Start Part 3');
    await clickButton(examiner, 'Start Part 3');
    await waitForButton(examiner, 'Submit score');
    await clickButton(examiner, 'Submit score');
  } catch (e) {
    const txt = await examiner
      .evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 600))
      .catch(() => '(page gone)');
    console.log(`  [driveRound failed] ${e.message}\n  [examiner page] ${txt}`);
    throw e;
  }
}

async function setupPlayer(browser, nickname) {
  const ctx = await browser.createBrowserContext();
  await ctx.overridePermissions(APP, ['camera', 'microphone']);
  const page = await ctx.newPage();
  page.on('pageerror', (err) => console.log(`  [pageerror ${nickname}] ${err.message}`));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder="Your nickname"]', { timeout: 15000 });
  await page.type('input[placeholder="Your nickname"]', nickname);
  await page.click('form button[type="submit"]');
  await waitForButton(page, 'Find a random partner');
  return { ctx, page };
}

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
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-dev-shm-usage',
      '--window-size=1280,900',
    ],
  });

  try {
    console.log('setup: two guest identities');
    const p1 = await setupPlayer(browser, 'AvCheck1');
    const p2 = await setupPlayer(browser, 'AvCheck2');
    check('both players reached the lobby', true);

    console.log('match: queue both');
    await Promise.all([clickButton(p1.page, 'Find a random partner'), clickButton(p2.page, 'Find a random partner')]);
    await Promise.all([
      p1.page.waitForSelector('.role-tag', { timeout: 15000 }),
      p2.page.waitForSelector('.role-tag', { timeout: 15000 }),
    ]);
    const roles = await Promise.all(
      [p1.page, p2.page].map((pg) => pg.$eval('.role-tag', (el) => el.textContent.trim())),
    );
    check('roles complementary (one examiner, one examinee)', roles[0] !== roles[1], roles.join(' / '));
    check('round 1 shown on both', await p1.page.evaluate(() => document.body.textContent.includes('Round 1 of 2')));

    console.log('ready: auto camera/mic on both');
    const pages = [p1.page, p2.page];
    const examinerIdx = roles[0] === 'examiner' ? 0 : 1;
    const examineeIdx = 1 - examinerIdx;
    // Camera + markReady now fire automatically on entering the match room
    // (getUserMedia → permission prompt → bothReady), so instead of clicking
    // the ReadyGate, wait for bothReady: the examiner's panel with
    // "Start Part 1" and the examinee's "Waiting for the examiner" only
    // render once both players are ready.
    await waitForButton(pages[examinerIdx], 'Start Part 1', 20000);
    await waitForText(pages[examineeIdx], 'Waiting for the examiner', 20000);
    const errs = await Promise.all(
      pages.map((pg) => pg.evaluate(() => document.querySelector('.error-text')?.textContent ?? '')),
    );
    check('no camera/permission errors', errs.every((e) => !e), errs.join(' | '));

    console.log('webrtc: wait for negotiation');
    const chipText = (pg) => pg.$eval('.conn-chip', (el) => el.textContent.trim()).catch(() => '(missing)');
    const deadline = Date.now() + 20000;
    let chips = ['', ''];
    while (Date.now() < deadline) {
      chips = await Promise.all([chipText(p1.page), chipText(p2.page)]);
      if (chips.every((c) => c === 'Connected')) break;
      await sleep(500);
    }
    check('both sides Connected', chips.every((c) => c === 'Connected'), chips.join(' / '));

    console.log('media: frames decoding');
    for (const [i, { page }] of [p1, p2].map((x, idx) => [idx, x])) {
      const info = await page.evaluate(() => {
        const videos = [...document.querySelectorAll('video')];
        return videos.map((v) => ({
          hasSrc: Boolean(v.srcObject),
          liveVideoTracks: v.srcObject
            ? v.srcObject.getTracks().filter((t) => t.kind === 'video' && t.readyState === 'live').length
            : 0,
          liveAudioTracks: v.srcObject
            ? v.srcObject.getTracks().filter((t) => t.kind === 'audio' && t.readyState === 'live').length
            : 0,
          w: v.videoWidth,
          h: v.videoHeight,
          muted: v.muted,
        }));
      });
      const self = info.find((v) => v.muted);
      const peer = info.find((v) => !v.muted);
      check(`p${i + 1}: self view attached (muted)`, Boolean(self && self.hasSrc && self.liveVideoTracks > 0), JSON.stringify(info));
      check(
        `p${i + 1}: peer video flowing with frames`,
        Boolean(peer && peer.liveVideoTracks > 0 && peer.w > 0 && peer.h > 0),
        JSON.stringify(info),
      );
      check(`p${i + 1}: peer audio track live`, Boolean(peer && peer.liveAudioTracks > 0), JSON.stringify(info));
    }

    console.log('badges: peer media state propagated');
    const badgeClean = async (pg) => {
      try {
        await pg.waitForFunction(
          () => ![...document.querySelectorAll('.badge.warn')].some((b) => /cam off|mic off/.test(b.textContent)),
          { timeout: 8000 },
        );
        return true;
      } catch {
        return false;
      }
    };
    const [b1, b2] = await Promise.all([badgeClean(p1.page), badgeClean(p2.page)]);
    check('peer mic/cam badges cleared on both (media:state relayed)', b1 && b2, `p1=${b1} p2=${b2}`);

    console.log('layout: stage + exam panel side by side');
    const layoutOk = await p1.page.evaluate(() => {
      const stage = document.querySelector('.video-stage');
      const exam = document.querySelector('.exam-col');
      return Boolean(stage && exam);
    });
    check('video stage and exam column both rendered', layoutOk);

    // Portrait phone: the video must stay pinned while the exam panel scrolls.
    console.log('mobile: video stays pinned while scrolling');
    const savedViewport = pages[examinerIdx].viewport();
    await pages[examinerIdx].setViewport({ width: 390, height: 700, deviceScaleFactor: 2 });
    const sticky = await pages[examinerIdx].evaluate(async () => {
      window.scrollTo(0, 0);
      const col = document.querySelector('.video-col');
      if (!col) return { ok: false, why: 'no .video-col' };
      const pos = getComputedStyle(col).position;
      // Inject a spacer so the assertion doesn't depend on panel content height.
      const probe = document.createElement('div');
      probe.style.height = '1600px';
      document.querySelector('.exam-col')?.appendChild(probe);
      window.scrollTo(0, 600);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const scrollY = window.scrollY;
      const top = col.getBoundingClientRect().top;
      probe.remove();
      window.scrollTo(0, 0);
      return {
        ok: pos === 'sticky' && scrollY > 150 && Math.abs(top) <= 2,
        why: `position=${pos} scrollY=${scrollY} top=${top.toFixed(1)}`,
      };
    });
    await pages[examinerIdx].setViewport(savedViewport);
    await pages[examinerIdx].evaluate(() => window.scrollTo(0, 0));
    check('portrait: video pinned at top while page scrolls', sticky.ok, sticky.why);

    const framesFlowing = (pg) =>
      pg.evaluate(() =>
        [...document.querySelectorAll('video')].some(
          (v) => !v.muted && v.srcObject && v.videoWidth > 0,
        ),
      );

    console.log('exam round 1: full flow → role swap');
    const preState = await Promise.all(
      pages.map((pg) =>
        pg
          .evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300))
          .catch(() => '(gone)'),
      ),
    );
    console.log(`  [p1] ${preState[0]}`);
    console.log(`  [p2] ${preState[1]}`);
    await driveRound(pages[examinerIdx]);
    await Promise.all(pages.map((pg) => waitForText(pg, 'Round 2 of 2')));
    const roles2 = await Promise.all(
      pages.map((pg) => pg.$eval('.role-tag', (el) => el.textContent.trim())),
    );
    check(
      'roles swapped for round 2',
      roles2[examinerIdx] === 'examinee' && roles2[examineeIdx] === 'examiner',
      roles2.join(' / '),
    );

    // One peer connection persists across the swap: chips never left Connected.
    const chips2 = await Promise.all(pages.map(chipText));
    check(
      'peer connection survived the swap',
      chips2.every((c) => c === 'Connected'),
      chips2.join(' / '),
    );

    // Round 2 auto-re-readies the same way (auto camera → markReady), so wait
    // for the new examiner's panel instead of clicking "I'm ready".
    await waitForButton(pages[examineeIdx], 'Start Part 1', 20000); // new examiner panel
    const framesAfterSwap = await Promise.all(pages.map(framesFlowing));
    check('A/V still flowing after swap', framesAfterSwap.every(Boolean), JSON.stringify(framesAfterSwap));

    console.log('exam round 2: full flow → results');
    await driveRound(pages[examineeIdx]);
    await Promise.all(pages.map((pg) => waitForText(pg, 'Match complete', 20000)));
    check('results view on both pages', true);
    const stageGone = await Promise.all(
      pages.map((pg) => pg.evaluate(() => !document.querySelector('.video-stage'))),
    );
    check('video stage torn down after completion', stageGone.every(Boolean), JSON.stringify(stageGone));
  } finally {
    await browser.close();
  }

  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('webrtc check crashed:', err);
  process.exit(1);
});
