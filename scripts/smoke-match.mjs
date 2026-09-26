/**
 * Two/three-client matchmaking smoke test against a running dev server.
 * Usage: node scripts/smoke-match.mjs
 */
import { io } from 'socket.io-client';

const BASE = 'http://localhost:3001';
let failures = 0;

function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
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
  if (!r.ok) throw new Error(`login failed for ${nickname}: ${r.status}`);
  return r.json();
}

const connect = (token) => io(BASE, { auth: { token } });

function once(sock, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    sock.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
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

async function main() {
  const socks = [];
  const track = (s) => {
    socks.push(s);
    return s;
  };

  console.log('test 1: random queue match');
  {
    const alice = await guest('AliceQ');
    const bob = await guest('BobQ');
    const sa = track(connect(alice.token));
    const sb = track(connect(bob.token));
    await Promise.all([connected(sa), connected(sb)]);

    // listeners BEFORE joining to avoid races
    const foundA = once(sa, 'match:found');
    const foundB = once(sb, 'match:found');
    const roundA = once(sa, 'round:start');
    const roundB = once(sb, 'round:start');
    const queuedA = once(sa, 'queue:update');

    const ackA = await ack(sa, 'queue:join');
    check('alice queue:join ok', ackA.ok === true, JSON.stringify(ackA));
    const qUpdate = await queuedA;
    check('alice got waiting=true', qUpdate.waiting === true, JSON.stringify(qUpdate));

    const ackB = await ack(sb, 'queue:join');
    check('bob queue:join ok', ackB.ok === true, JSON.stringify(ackB));

    const [fa, fb] = await Promise.all([foundA, foundB]);
    check('same matchId', fa.matchId === fb.matchId, `${fa.matchId} vs ${fb.matchId}`);
    check(
      'roles differ',
      fa.yourRole !== fb.yourRole,
      `${fa.yourRole} / ${fb.yourRole}`,
    );
    check('alice is examiner (first in queue)', fa.yourRole === 'examiner', fa.yourRole);
    check('peer nicknames correct', fa.peer.nickname === 'BobQ' && fb.peer.nickname === 'AliceQ');

    const [ra, rb] = await Promise.all([roundA, roundB]);
    check('round 1 both', ra.roundNumber === 1 && rb.roundNumber === 1);
    check(
      'set payload complete',
      ra.set.part1.length === 3 && ra.set.part2.length === 3 && ra.set.part3.length === 4,
      JSON.stringify({
        p1: ra.set.part1.length,
        p2: ra.set.part2.length,
        p3: ra.set.part3.length,
      }),
    );

    // double-join guard
    const again = await ack(sa, 'queue:join');
    check('double queue rejected', again.ok === false && again.error === 'already_in_session', JSON.stringify(again));

    sa.close();
    sb.close();
  }

  console.log('test 2: room codes');
  {
    const carol = await guest('CarolR');
    const dave = await guest('DaveR');
    const sc = track(connect(carol.token));
    const sd = track(connect(dave.token));
    await Promise.all([connected(sc), connected(sd)]);

    const created = await ack(sc, 'room:create');
    check('room created with 6-char code', created.ok === true && /^[A-Z2-9]{6}$/.test(created.code), JSON.stringify(created));

    const bad = await ack(sd, 'room:join', 'ZZZZZZ');
    check('wrong code rejected', bad.ok === false && bad.error === 'not_found', JSON.stringify(bad));

    const foundC = once(sc, 'match:found');
    const foundD = once(sd, 'match:found');

    const joined = await ack(sd, 'room:join', created.code);
    check('correct code joins', joined.ok === true, JSON.stringify(joined));

    const [fc, fd] = await Promise.all([foundC, foundD]);
    check('host is examiner', fc.yourRole === 'examiner' && fd.yourRole === 'examinee');
    check('match carries code', fc.code === created.code && fd.code === created.code);
    check('same matchId', fc.matchId === fd.matchId);

    sc.close();
    sd.close();
  }

  console.log('test 3: disconnect abandons match');
  {
    const erin = await guest('ErinD');
    const frank = await guest('FrankD');
    const se = track(connect(erin.token));
    const sf = track(connect(frank.token));
    await Promise.all([connected(se), connected(sf)]);

    const foundE = once(se, 'match:found');
    await ack(se, 'queue:join');
    await ack(sf, 'queue:join');
    const fe = await foundE;

    const down = once(se, 'peer:disconnected');
    sf.close();
    await down;
    check('remaining peer notified of disconnect', true);

    // try to queue again after abandonment — erin should be free
    const requeue = await ack(se, 'queue:join');
    check('erin can queue again after abandon', requeue.ok === true, JSON.stringify(requeue));
    se.close();
  }

  console.log('test 4: explicit leave releases both players');
  {
    const gina = await guest('GinaL');
    const hank = await guest('HankL');
    const sg = track(connect(gina.token));
    const sh = track(connect(hank.token));
    await Promise.all([connected(sg), connected(sh)]);

    const created = await ack(sg, 'room:create');
    const foundG = once(sg, 'match:found');
    const foundH = once(sh, 'match:found');
    await ack(sh, 'room:join', created.code);
    await Promise.all([foundG, foundH]);

    const leftH = once(sh, 'match:left');
    sg.emit('match:leave');
    const left = await leftH;
    check('peer notified of explicit leave', left.byUserId === gina.userId, JSON.stringify(left));

    const requeueH = await ack(sh, 'queue:join');
    check('receiver can queue right after peer left', requeueH.ok === true, JSON.stringify(requeueH));
    const requeueG = await ack(sg, 'queue:join');
    check('leaver can queue again', requeueG.ok === true, JSON.stringify(requeueG));

    sg.emit('queue:leave');
    sh.emit('queue:leave');
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log('test 5: webrtc signaling relay + media state');
  {
    const iris = await guest('IrisS');
    const jack = await guest('JackS');
    const si = track(connect(iris.token));
    const sj = track(connect(jack.token));
    await Promise.all([connected(si), connected(sj)]);

    const foundI = once(si, 'match:found');
    await ack(si, 'queue:join');
    await ack(sj, 'queue:join');
    const fi = await foundI;
    check('signaling pair matched', Boolean(fi.matchId));

    // offer: examiner → examinee
    const offerAtB = once(sj, 'webrtc:offer', 2000);
    si.emit('webrtc:offer', { description: { type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n' } });
    const gotOffer = await offerAtB;
    check(
      'offer relayed to peer with description intact',
      gotOffer?.description?.type === 'offer' && typeof gotOffer?.description?.sdp === 'string',
      JSON.stringify(gotOffer),
    );

    // answer: examinee → examiner
    const answerAtA = once(si, 'webrtc:answer', 2000);
    sj.emit('webrtc:answer', { description: { type: 'answer', sdp: 'v=0\r\no=- 2 1 IN IP4 127.0.0.1\r\n' } });
    const gotAnswer = await answerAtA;
    check('answer relayed to caller', gotAnswer?.description?.type === 'answer', JSON.stringify(gotAnswer));

    // ice: both directions
    const iceAtB = once(sj, 'webrtc:ice', 2000);
    si.emit('webrtc:ice', {
      candidate: { candidate: 'candidate:1 1 udp 2122260223 192.0.2.1 54321 typ host', sdpMid: '0', sdpMLineIndex: 0 },
    });
    const gotIce = await iceAtB;
    check('ice candidate relayed', typeof gotIce?.candidate?.candidate === 'string', JSON.stringify(gotIce));

    // media state → peer:media with coerced booleans
    const mediaAtB = once(sj, 'peer:media', 2000);
    si.emit('media:state', { mic: true, cam: 'yes' }); // cam is junk → must coerce to false
    const gotMedia = await mediaAtB;
    check(
      'media:state relayed and sanitized',
      gotMedia?.mic === true && gotMedia?.cam === false,
      JSON.stringify(gotMedia),
    );

    // junk offer must NOT reach the peer
    let junkRelayed = false;
    sj.once('webrtc:offer', () => {
      junkRelayed = true;
    });
    si.emit('webrtc:offer', { description: 'not-an-object' });
    si.emit('webrtc:offer', 'bare-string');
    await new Promise((r) => setTimeout(r, 300));
    check('junk offer dropped (not relayed)', junkRelayed === false);

    // out-of-match socket emits signals → silently dropped, no crash
    const eve = await guest('EveO');
    const se = track(connect(eve.token));
    await connected(se);
    let oob = false;
    se.on('webrtc:offer', () => {
      oob = true;
    });
    se.emit('webrtc:offer', { description: { type: 'offer', sdp: 'v=0' } });
    se.emit('media:state', { mic: true, cam: true });
    await new Promise((r) => setTimeout(r, 300));
    check('signals from out-of-match socket ignored', oob === false);

    si.close();
    sj.close();
    se.close();
  }

  for (const s of socks) s.close();
  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('smoke test crashed:', err);
  process.exit(1);
});
