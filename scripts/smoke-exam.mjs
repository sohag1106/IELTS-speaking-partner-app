/**
 * Phase 3 smoke test: full two-round exam flow through the socket protocol.
 * Requires the dev server on :3001. Usage: node scripts/smoke-exam.mjs
 */
import { io } from 'socket.io-client';

const BASE = 'http://localhost:3001';
let failures = 0;

function check(name, cond, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

async function guest(nickname) {
  const r = await fetch(`${BASE}/api/auth/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  if (!r.ok) throw new Error(`login failed for ${nickname}`);
  return r.json();
}

const connect = (token) => io(BASE, { auth: { token } });

function once(sock, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    sock.once(event, (p) => {
      clearTimeout(t);
      resolve(p);
    });
  });
}

function collect(sock, event, n, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const seen = [];
    const t = setTimeout(
      () => reject(new Error(`timeout: ${event} x${n} (got ${seen.length})`)),
      timeoutMs,
    );
    const handler = (p) => {
      seen.push(p);
      if (seen.length >= n) {
        clearTimeout(t);
        sock.off(event, handler);
        resolve(seen);
      }
    };
    sock.on(event, handler);
  });
}

function ack(sock, event, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack timeout: ${event}`)), timeoutMs);
    const cb = (res) => {
      clearTimeout(t);
      resolve(res);
    };
    if (payload === undefined) sock.emit(event, cb);
    else sock.emit(event, payload, cb);
  });
}

const connected = (sock) =>
  sock.connected ? Promise.resolve() : once(sock, 'connect');

/**
 * Drive Parts 1–3 + score for one round.
 * When expectSwap is true (round 1), returns the round-2 round:start payloads;
 * both are subscribed BEFORE the score lands so nothing is missed.
 */
async function runRound(ioExaminer, ioExaminee, examinerName, band, expectSwap) {
  const step = async (payload, assertFn, name) => {
    const ea = once(ioExaminer, 'part:changed');
    const eb = once(ioExaminee, 'part:changed');
    const res = await ack(ioExaminer, 'part:start', payload);
    check(
      `${examinerName}: part:start ${JSON.stringify(payload)} ok`,
      res.ok === true,
      JSON.stringify(res),
    );
    const [pa, pb] = await Promise.all([ea, eb]);
    check(
      `${examinerName}: both saw part:changed — ${name}`,
      assertFn(pa) && assertFn(pb),
      JSON.stringify({ pa, pb }),
    );
  };

  await step({ part: 1 }, (p) => p.part === 1 && p.maxPart === 1, 'part 1 active');

  // Score guards while only part 1 has run
  const earlyScore = await ack(ioExaminer, 'score:submit', { band: 5 });
  check(
    `${examinerName}: score rejected before part 3`,
    earlyScore.error === 'part3_required',
    JSON.stringify(earlyScore),
  );
  const skipped = await ack(ioExaminer, 'part:start', { part: 3 });
  check(`${examinerName}: cannot skip to part 3`, skipped.error === 'bad_part', JSON.stringify(skipped));
  const notEx = await ack(ioExaminee, 'part:start', { part: 2, cardOrdinal: 1 });
  check(`${examinerName}: examinee cannot drive parts`, notEx.error === 'not_examiner', JSON.stringify(notEx));

  // Part 2 → prep timer
  const timerStart = once(ioExaminer, 'timer:start');
  const ea2 = once(ioExaminer, 'part:changed');
  const eb2 = once(ioExaminee, 'part:changed');
  const r2 = await ack(ioExaminer, 'part:start', { part: 2, cardOrdinal: 2 });
  check(`${examinerName}: part 2 starts`, r2.ok === true, JSON.stringify(r2));
  const [ts, pa2, pb2] = await Promise.all([timerStart, ea2, eb2]);
  check(
    `${examinerName}: prep timer running`,
    ts.id === 'part2_prep' && ts.endsAt > Date.now() && ts.durationSec >= 1,
    JSON.stringify(ts),
  );
  check(
    `${examinerName}: both see prep + card`,
    pa2.stage === 'prep' && pb2.stage === 'prep' && pa2.card && pb2.card,
    JSON.stringify({ pa2, pb2 }),
  );

  // Hide now → card gone everywhere
  const timerEnd = once(ioExaminer, 'timer:end');
  const ea3 = once(ioExaminer, 'part:changed');
  const eb3 = once(ioExaminee, 'part:changed');
  const hide = await ack(ioExaminer, 'part2:hide_now');
  check(`${examinerName}: hide now ok`, hide.ok === true, JSON.stringify(hide));
  const [te, pa3, pb3] = await Promise.all([timerEnd, ea3, eb3]);
  check(`${examinerName}: timer ended`, te.id === 'part2_prep', JSON.stringify(te));
  check(
    `${examinerName}: card hidden on both`,
    pa3.stage === 'ended' && pb3.stage === 'ended' && pa3.card === null && pb3.card === null,
    JSON.stringify({ pa3, pb3 }),
  );

  // Part 2 not repeatable, then part 3
  const again = await ack(ioExaminer, 'part:start', { part: 2, cardOrdinal: 1 });
  check(`${examinerName}: part 2 not repeatable`, again.error === 'bad_part', JSON.stringify(again));
  await step({ part: 3 }, (p) => p.part === 3 && p.maxPart === 3, 'part 3 active');

  // Bad band rejected, then the real score
  const bad = await ack(ioExaminer, 'score:submit', { band: 7.25 });
  check(`${examinerName}: fractional band rejected`, bad.error === 'bad_band', JSON.stringify(bad));

  const scoredA = once(ioExaminer, 'round:scored');
  const scoredB = once(ioExaminee, 'round:scored');
  const swapA = expectSwap ? once(ioExaminer, 'round:start') : null;
  const swapB = expectSwap ? once(ioExaminee, 'round:start') : null;

  const submit = await ack(ioExaminer, 'score:submit', { band });
  check(`${examinerName}: score ${band} accepted`, submit.ok === true, JSON.stringify(submit));
  const [s1, s2] = await Promise.all([scoredA, scoredB]);
  check(
    `${examinerName}: both saw round:scored`,
    s1.band === band && s2.band === band,
    JSON.stringify({ s1, s2 }),
  );

  if (expectSwap) {
    const [x1, x2] = await Promise.all([swapA, swapB]);
    check(
      `${examinerName}: round 2 announced to both`,
      x1.roundNumber === 2 && x2.roundNumber === 2,
      JSON.stringify({ x1, x2 }),
    );
    return { swap1: x1, swap2: x2 };
  }
  return null;
}

async function main() {
  const ivy = await guest('IvyX');
  const jack = await guest('JackX');
  const si = connect(ivy.token);
  const sj = connect(jack.token);
  await Promise.all([connected(si), connected(sj)]);

  console.log('setup: match');
  const foundI = once(si, 'match:found');
  const foundJ = once(sj, 'match:found');
  const roundI = once(si, 'round:start');
  const roundJ = once(sj, 'round:start');
  await ack(si, 'queue:join');
  await ack(sj, 'queue:join');
  const [fi, fj] = await Promise.all([foundI, foundJ]);
  const [r1i, r1j] = await Promise.all([roundI, roundJ]);
  check(
    'ivy is round-1 examiner (queued first)',
    fi.yourRole === 'examiner' && fj.yourRole === 'examinee',
  );
  check('same set payload both sides', r1i.set.id === r1j.set.id);
  const set1Id = r1i.set.id;

  console.log('round 1: ivy examines jack (band 6.5)');
  const notReady = await ack(si, 'part:start', { part: 1 });
  check('part 1 blocked until both ready', notReady.error === 'not_ready', JSON.stringify(notReady));

  const readyEventsI = collect(si, 'peer:ready', 2);
  const readyEventsJ = collect(sj, 'peer:ready', 2);
  check('ivy ready', (await ack(si, 'match:ready')).ok === true);
  check('jack ready', (await ack(sj, 'match:ready')).ok === true);
  const [reI, reJ] = await Promise.all([readyEventsI, readyEventsJ]);
  check(
    'peer:ready delivered both ways',
    reI.some((e) => e.userId === ivy.userId) &&
      reI.some((e) => e.userId === jack.userId) &&
      reJ.some((e) => e.userId === ivy.userId) &&
      reJ.some((e) => e.userId === jack.userId),
    JSON.stringify({ reI, reJ }),
  );

  const swap = await runRound(si, sj, 'ivy', 6.5, true);
  check(
    'round 2 roles flipped in round:start',
    swap.swap1.examinerId === jack.userId && swap.swap1.examineeId === ivy.userId,
    JSON.stringify(swap.swap1),
  );
  check(
    'round 2 uses a different question set',
    swap.swap1.set.id !== set1Id,
    `${set1Id} → ${swap.swap1.set.id}`,
  );

  console.log('round 2: jack examines ivy (band 7.5)');
  const notReady2 = await ack(sj, 'part:start', { part: 1 });
  check('round 2 also requires readiness', notReady2.error === 'not_ready', JSON.stringify(notReady2));
  const ready2I = collect(si, 'peer:ready', 2);
  const ready2J = collect(sj, 'peer:ready', 2);
  check('jack ready r2', (await ack(sj, 'match:ready')).ok === true);
  check('ivy ready r2', (await ack(si, 'match:ready')).ok === true);
  await Promise.all([ready2I, ready2J]);

  const compI = once(si, 'match:completed');
  const compJ = once(sj, 'match:completed');
  await runRound(sj, si, 'jack', 7.5, false);
  const [cI, cJ] = await Promise.all([compI, compJ]);

  console.log('completion');
  check('match completed on both', Array.isArray(cI.rounds) && cI.rounds.length === 2, JSON.stringify(cI));
  check('completed payload identical', JSON.stringify(cI) === JSON.stringify(cJ));
  const bands = cI.rounds.map((r) => r.band).sort();
  check('bands are 6.5 and 7.5', bands[0] === 6.5 && bands[1] === 7.5, JSON.stringify(bands));
  const r2 = cI.rounds.find((r) => r.roundNumber === 2);
  check(
    'round 2 roles flipped in completion',
    r2.examinerId === jack.userId && r2.examineeId === ivy.userId,
    JSON.stringify(r2),
  );

  const again = await ack(sj, 'score:submit', { band: 3 });
  check(
    'extra score rejected',
    again.error === 'already_scored' || again.error === 'round_finished',
    JSON.stringify(again),
  );

  console.log('profile persistence');
  const meIvy = await (await fetch(`${BASE}/api/me`, { headers: { authorization: `Bearer ${ivy.token}` } })).json();
  const meJack = await (await fetch(`${BASE}/api/me`, { headers: { authorization: `Bearer ${jack.token}` } })).json();
  check(
    'ivy received 1 score (7.5)',
    meIvy.stats.count === 1 && Number(meIvy.stats.avgBand) === 7.5,
    JSON.stringify(meIvy.stats),
  );
  check(
    'jack received 1 score (6.5)',
    meJack.stats.count === 1 && Number(meJack.stats.avgBand) === 6.5,
    JSON.stringify(meJack.stats),
  );

  si.close();
  sj.close();
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('exam smoke test crashed:', err);
  process.exit(1);
});
