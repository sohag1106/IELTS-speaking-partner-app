/**
 * Visual check of the new mobile layout at 390x844: examiner face strip, the
 * pinned Part 2 cue card, and the keyboard-open state. Saves screenshots to
 * /tmp/mobile-*.png.  Usage: node scripts/mobile-shots.mjs  (dev server running)
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function click(page, text) {
  const ok = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t) && !x.disabled);
    if (!b) return false;
    b.click();
    return true;
  }, text);
  if (!ok) throw new Error(`button not found: ${text}`);
}

async function waitBtn(page, text, timeout = 20000) {
  await page.waitForFunction(
    (t) => [...document.querySelectorAll('button')].some((b) => b.textContent.includes(t) && !b.disabled),
    { timeout },
    text,
  );
}

/** Puppeteer cannot open a real phone keyboard; shrink visualViewport instead. */
async function setKeyboard(page, open) {
  if (open) {
    await page.evaluate(() => {
      const vv = window.visualViewport;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => 380 });
      vv.dispatchEvent(new Event('resize'));
    });
  } else {
    await page.evaluate(() => {
      const vv = window.visualViewport;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight });
      vv.dispatchEvent(new Event('resize'));
    });
  }
  await sleep(400);
}

async function play(browser, nick) {
  const ctx = await browser.createBrowserContext();
  await ctx.overridePermissions(APP, ['camera', 'microphone']);
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log(`  [pageerror ${nick}] ${e.message}`));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder="Your nickname"]');
  await page.type('input[placeholder="Your nickname"]', nick);
  await page.click('form button[type="submit"]');
  await waitBtn(page, 'Find a partner');
  return { ctx, page };
}

const box = (sel) =>
  `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), pos: getComputedStyle(e).position }; })()`;

async function main() {
  const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const a = await play(browser, 'ShotA');
    const b = await play(browser, 'ShotB');
    await Promise.all([click(a.page, 'Find a partner'), click(b.page, 'Find a partner')]);
    await Promise.all([
      a.page.waitForSelector('.role-tag', { timeout: 20000 }),
      b.page.waitForSelector('.role-tag', { timeout: 20000 }),
    ]);

    const roles = await Promise.all([a.page, b.page].map((p) => p.$eval('.role-tag', (e) => e.textContent.trim())));
    const examiner = roles[0] === 'examiner' ? a.page : b.page;
    const examinee = roles[0] === 'examiner' ? b.page : a.page;
    console.log('roles:', roles.join(' / '));

    // ── 1. Examiner, Part 1: face strip + question bank ──────────────
    await waitBtn(examiner, 'Start Part 1', 30000);
    await click(examiner, 'Start Part 1');
    await sleep(1200);
    const strip = await examiner.evaluate(
      (sel) => ({
        video: eval(sel.video),
        controls: eval(sel.controls),
        pinned: getComputedStyle(document.querySelector('.video-col')).position,
        bandPct: Math.round(
          (document.querySelector('.video-col').getBoundingClientRect().height / window.innerHeight) * 100,
        ),
      }),
      { video: box('.video-main'), controls: box('.control-dock') },
    );
    console.log('examiner strip:', JSON.stringify(strip));

    await examiner.evaluate(() => window.scrollTo(0, 900));
    await sleep(700);
    const scrolled = await examiner.evaluate(() => ({
      videoTop: Math.round(document.querySelector('.video-main').getBoundingClientRect().top),
      scrollY: Math.round(window.scrollY),
    }));
    console.log('examiner scrolled:', JSON.stringify(scrolled));
    await examiner.screenshot({ path: '/tmp/mobile-1-examiner-scrolled.png' });

    // ── 2. Examinee, Part 2 prep: cue card pinned under a short strip ─
    await click(examiner, 'choose a cue card');
    await waitBtn(examiner, 'Start this card');
    await click(examiner, 'Start this card');
    await sleep(1500);
    const prep = await examinee.evaluate(() => {
      const col = document.querySelector('.video-col').getBoundingClientRect();
      const cue = document.querySelector('.video-col .cue-card').getBoundingClientRect();
      const visible = [...document.querySelectorAll('.cue-card')].filter((c) => c.getBoundingClientRect().height > 0);
      return {
        bandPct: Math.round((col.height / window.innerHeight) * 100),
        cueH: Math.round(cue.height),
        cueBottom: Math.round(cue.bottom),
        visibleCards: visible.length,
        notesTop: Math.round(document.querySelector('.scratchpad textarea').getBoundingClientRect().top),
      };
    });
    console.log('prep:', JSON.stringify(prep));
    await examinee.screenshot({ path: '/tmp/mobile-2-prep.png' });

    await examinee.evaluate(() => window.scrollTo(0, 400));
    await sleep(600);
    const prepScrolled = await examinee.evaluate(() => {
      const cue = document.querySelector('.video-col .cue-card').getBoundingClientRect();
      return { cueTop: Math.round(cue.top), visible: cue.top >= 0 && cue.top < window.innerHeight };
    });
    console.log('prep scrolled:', JSON.stringify(prepScrolled));

    // ── 3. Keyboard up: notes get the screen ─────────────────────────
    await examinee.evaluate(() => {
      document.querySelector('.scratchpad textarea').focus();
      window.scrollTo(0, document.body.scrollHeight);
    });
    await sleep(400);
    await setKeyboard(examinee, true);
    await sleep(600);
    const kb = await examinee.evaluate(() => {
      const ta = document.querySelector('.scratchpad textarea').getBoundingClientRect();
      const vh = window.visualViewport.height;
      return {
        videoShown: getComputedStyle(document.querySelector('.video-col')).display !== 'none',
        cards: document.querySelectorAll('.cue-card').length,
        visibleCards: [...document.querySelectorAll('.cue-card')].filter((c) => c.getBoundingClientRect().height > 0).length,
        textareaTop: Math.round(ta.top),
        textareaAboveKeyboard: ta.top < vh,
        audioEls: document.querySelectorAll('audio, video').length,
      };
    });
    console.log('keyboard up:', JSON.stringify(kb));
    await examinee.screenshot({ path: '/tmp/mobile-3-keyboard.png' });

    await setKeyboard(examinee, false);
    const kbDown = await examinee.evaluate(() => ({
      videoShown: getComputedStyle(document.querySelector('.video-col')).display !== 'none',
      cueH: Math.round(document.querySelector('.video-col .cue-card').getBoundingClientRect().height),
    }));
    console.log('keyboard down:', JSON.stringify(kbDown));

    // ── 4. Talk stage: wait out prep so the card hides itself ────────
    console.log('waiting out the prep timer…');
    await examinee.waitForFunction(
      () => document.body.textContent.includes('Preparation time is over'),
      { timeout: 90000 },
    );
    await sleep(1200);
    const talk = await examinee.evaluate(() => {
      const strip = document.querySelector('.video-col .countdown-strip');
      const s = strip ? strip.getBoundingClientRect() : null;
      const notes = document.querySelector('.scratchpad').getBoundingClientRect();
      return {
        hasStrip: !!strip,
        stripTop: s ? Math.round(s.top) : null,
        // Stop 07: the seconds sit directly under the pinned face.
        stripInView: s ? s.top >= 0 && s.bottom <= window.innerHeight : false,
        videoH: Math.round(document.querySelector('.video-main').getBoundingClientRect().height),
        cardGone: !document.querySelector('.video-col .cue-card'),
        notesTop: Math.round(notes.top),
        stickyCue: document.querySelector('.match-layout').classList.contains('sticky-cue'),
      };
    });
    console.log('talk:', JSON.stringify(talk));
    await examinee.screenshot({ path: '/tmp/mobile-4-talk.png' });

    // Scroll: the strip is pinned with the face, so it stays put.
    await examinee.evaluate(() => window.scrollTo(0, 600));
    await sleep(600);
    const talkScrolled = await examinee.evaluate(() => {
      const strip = document.querySelector('.video-col .countdown-strip');
      return {
        stripTop: strip ? Math.round(strip.getBoundingClientRect().top) : null,
        sticky: getComputedStyle(document.querySelector('.video-col')).position,
      };
    });
    console.log('talk scrolled (strip pinned with the face):', JSON.stringify(talkScrolled));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
