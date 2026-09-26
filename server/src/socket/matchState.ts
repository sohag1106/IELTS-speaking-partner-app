import type { Server, Socket } from 'socket.io';
import { env } from '../env.js';
import {
  completeMatch,
  createRound,
  getRoundId,
  markRoundScored,
  updateRoundProgress,
} from '../db/repos/matchesRepo.js';
import { insertScore } from '../db/repos/scoresRepo.js';
import { sanitizeText } from '../util/text.js';
import { getSetPayload, type QuestionSetPayload } from '../db/repos/questionsRepo.js';
import {
  S2C,
  type FollowupPayload,
  type PartChangedPayload,
  type PartStartPayload,
  type PeerReadyPayload,
  type RoundScoredPayload,
  type RoundStartPayload,
  type ScoreSubmitPayload,
  type TimerStartPayload,
} from './protocol.js';

type Ack = (res: { ok: boolean; error?: string }) => void;

export interface RoundScoreRecord {
  roundNumber: 1 | 2;
  band: number;
  examinerId: string;
  examineeId: string;
}

interface ExamMatch {
  matchId: string;
  examinerR1: string; // userId
  examineeR1: string;
  socketIds: [string, string];
  setR2Id: string;
  set: QuestionSetPayload;
  roundNumber: 1 | 2;
  ready: Set<string>;
  part: 0 | 1 | 2 | 3;
  maxPart: number;
  stage: 'prep' | 'talk' | 'ended' | null;
  cardOrdinal: number | null;
  prepTimer?: ReturnType<typeof setTimeout>;
  talkTimer?: ReturnType<typeof setTimeout>;
  roundIds: Map<1 | 2, string>;
  scores: RoundScoreRecord[];
  completed: boolean;
}

const exams = new Map<string, ExamMatch>();

export function initMatchState(opts: {
  matchId: string;
  examinerR1: string;
  examineeR1: string;
  socketIds: [string, string];
  setR1: QuestionSetPayload;
  setR2Id: string;
}): void {
  exams.set(opts.matchId, {
    matchId: opts.matchId,
    examinerR1: opts.examinerR1,
    examineeR1: opts.examineeR1,
    socketIds: opts.socketIds,
    setR2Id: opts.setR2Id,
    set: opts.setR1,
    roundNumber: 1,
    ready: new Set(),
    part: 0,
    maxPart: 0,
    stage: null,
    cardOrdinal: null,
    roundIds: new Map(),
    scores: [],
    completed: false,
  });
}

/** Stop timers and forget the match (leave or disconnect). */
export function clearMatchState(matchId: string): void {
  const st = exams.get(matchId);
  if (!st) return;
  if (st.prepTimer) clearTimeout(st.prepTimer);
  if (st.talkTimer) clearTimeout(st.talkTimer);
  exams.delete(matchId);
}

function fail(ack: Ack | undefined, error: string): void {
  ack?.({ ok: false, error });
}

function emitBoth(io: Server, st: ExamMatch, event: string, payload: unknown): void {
  for (const sid of st.socketIds) io.to(sid).emit(event, payload);
}

function examinerIdOf(st: ExamMatch): string {
  return st.roundNumber === 1 ? st.examinerR1 : st.examineeR1;
}

function examineeIdOf(st: ExamMatch): string {
  return st.roundNumber === 1 ? st.examineeR1 : st.examinerR1;
}

function partChanged(st: ExamMatch): PartChangedPayload {
  const card =
    st.part === 2 &&
    (st.stage === 'prep' || st.stage === 'talk') &&
    st.cardOrdinal !== null
      ? (() => {
          const c = st.set.part2.find((x) => x.ordinal === st.cardOrdinal);
          return c ? { prompt: c.prompt, leadIn: c.leadIn, bullets: c.bullets } : null;
        })()
      : null;
  return {
    roundNumber: st.roundNumber,
    part: st.part,
    stage: st.stage ?? undefined,
    card,
    maxPart: st.maxPart,
  };
}

async function roundIdFor(st: ExamMatch): Promise<string | null> {
  const cached = st.roundIds.get(st.roundNumber);
  if (cached) return cached;
  const id = await getRoundId(st.matchId, st.roundNumber);
  if (id) st.roundIds.set(st.roundNumber, id);
  return id;
}

/** Fire-and-forget progress bookkeeping; never blocks the exam flow. */
function persistProgress(st: ExamMatch): void {
  void roundIdFor(st)
    .then((id) => (id ? updateRoundProgress(id, st.maxPart) : undefined))
    .catch((err) => console.error('[matchState] progress persist failed:', err));
}

function clearPart2Timers(st: ExamMatch): { hadTimer: boolean; id: 'part2_prep' | 'part2_talk' } {
  const hadTimer = Boolean(st.prepTimer || st.talkTimer);
  const id: 'part2_prep' | 'part2_talk' = st.prepTimer ? 'part2_prep' : 'part2_talk';
  if (st.prepTimer) clearTimeout(st.prepTimer);
  if (st.talkTimer) clearTimeout(st.talkTimer);
  st.prepTimer = undefined;
  st.talkTimer = undefined;
  return { hadTimer, id };
}

function startPrepTimer(io: Server, st: ExamMatch): void {
  const durationSec = env.part2PrepSeconds;
  const payload: TimerStartPayload = {
    id: 'part2_prep',
    label: 'part2_prep',
    endsAt: Date.now() + durationSec * 1000,
    durationSec,
  };
  emitBoth(io, st, S2C.TIMER_START, payload);
  st.prepTimer = setTimeout(() => {
    st.prepTimer = undefined;
    emitBoth(io, st, S2C.TIMER_END, { id: 'part2_prep', label: 'part2_prep' });
    if (st.stage !== 'prep') return; // force-hidden or torn down meanwhile
    st.stage = 'talk';
    emitBoth(io, st, S2C.PART_CHANGED, partChanged(st));
    startTalkTimer(io, st);
  }, durationSec * 1000);
}

function startTalkTimer(io: Server, st: ExamMatch): void {
  const durationSec = env.part2TalkSeconds;
  const payload: TimerStartPayload = {
    id: 'part2_talk',
    label: 'part2_talk',
    endsAt: Date.now() + durationSec * 1000,
    durationSec,
  };
  emitBoth(io, st, S2C.TIMER_START, payload);
  st.talkTimer = setTimeout(() => {
    st.talkTimer = undefined;
    emitBoth(io, st, S2C.TIMER_END, { id: 'part2_talk', label: 'part2_talk' });
    if (st.stage !== 'talk') return;
    st.stage = 'ended';
    emitBoth(io, st, S2C.PART_CHANGED, partChanged(st));
  }, durationSec * 1000);
}

function getExam(socket: Socket): ExamMatch | undefined {
  const matchId = socket.data.matchId;
  if (!matchId) return undefined;
  return exams.get(matchId);
}

export function handleMatchReady(_io: Server, socket: Socket, ack?: Ack): void {
  const st = getExam(socket);
  if (!st) {
    fail(ack, 'not_in_match');
    return;
  }
  const uid = socket.data.userId;
  if (!st.ready.has(uid)) {
    st.ready.add(uid);
    const payload: PeerReadyPayload = { userId: uid };
    emitBoth(_io, st, S2C.PEER_READY, payload);
  }
  ack?.({ ok: true });
}

export async function handlePartStart(
  io: Server,
  socket: Socket,
  raw: unknown,
  ack?: Ack,
): Promise<void> {
  const st = getExam(socket);
  if (!st) {
    fail(ack, 'not_in_match');
    return;
  }
  if (socket.data.userId !== examinerIdOf(st)) {
    fail(ack, 'not_examiner');
    return;
  }
  if (st.completed || st.scores.some((s) => s.roundNumber === st.roundNumber)) {
    fail(ack, 'round_finished');
    return;
  }
  const payload = raw as PartStartPayload | undefined;
  const part = payload?.part;
  if (part !== 1 && part !== 2 && part !== 3) {
    fail(ack, 'bad_part');
    return;
  }
  if (st.stage === 'prep' || st.stage === 'talk') {
    fail(ack, 'part2_active');
    return;
  }
  if (part !== st.maxPart + 1) {
    fail(ack, 'bad_part');
    return;
  }

  if (part === 1) {
    if (st.ready.size < 2) {
      fail(ack, 'not_ready');
      return;
    }
    st.part = 1;
    st.maxPart = 1;
    st.stage = null;
    st.cardOrdinal = null;
    persistProgress(st);
    emitBoth(io, st, S2C.PART_CHANGED, partChanged(st));
    ack?.({ ok: true });
    return;
  }

  if (part === 2) {
    const ordinal = payload?.cardOrdinal;
    if (ordinal !== 1 && ordinal !== 2 && ordinal !== 3) {
      fail(ack, 'bad_card');
      return;
    }
    const card = st.set.part2.find((c) => c.ordinal === ordinal);
    if (!card) {
      fail(ack, 'bad_card');
      return;
    }
    st.part = 2;
    st.maxPart = 2;
    st.stage = 'prep';
    st.cardOrdinal = ordinal;
    persistProgress(st);
    emitBoth(io, st, S2C.PART_CHANGED, partChanged(st));
    startPrepTimer(io, st);
    ack?.({ ok: true });
    return;
  }

  // part === 3
  st.part = 3;
  st.maxPart = 3;
  st.stage = null;
  st.cardOrdinal = null;
  persistProgress(st);
  emitBoth(io, st, S2C.PART_CHANGED, partChanged(st));
  ack?.({ ok: true });
}

export function handleHideNow(io: Server, socket: Socket, ack?: Ack): void {
  const st = getExam(socket);
  if (!st) {
    fail(ack, 'not_in_match');
    return;
  }
  if (socket.data.userId !== examinerIdOf(st)) {
    fail(ack, 'not_examiner');
    return;
  }
  if (st.stage !== 'prep' && st.stage !== 'talk') {
    fail(ack, 'not_active');
    return;
  }
  const { id } = clearPart2Timers(st);
  st.stage = 'ended';
  emitBoth(io, st, S2C.TIMER_END, { id, label: id });
  emitBoth(io, st, S2C.PART_CHANGED, partChanged(st));
  ack?.({ ok: true });
}

/** Examiner sends a free-text follow-up question; both sides receive it. */
export function handleFollowupAsk(io: Server, socket: Socket, raw: unknown, ack?: Ack): void {
  const st = getExam(socket);
  if (!st) {
    fail(ack, 'not_in_match');
    return;
  }
  if (socket.data.userId !== examinerIdOf(st)) {
    fail(ack, 'not_examiner');
    return;
  }
  if (st.completed) {
    fail(ack, 'completed');
    return;
  }
  if (st.part === 0) {
    fail(ack, 'not_started');
    return;
  }
  const rawText = (raw as { text?: unknown } | null)?.text;
  const text = sanitizeText(typeof rawText === 'string' ? rawText : '', 200);
  if (text.length < 2) {
    fail(ack, 'bad_text');
    return;
  }
  const payload: FollowupPayload = { text };
  emitBoth(io, st, S2C.FOLLOWUP_NEW, payload);
  ack?.({ ok: true });
}

export async function handleSubmitScore(
  io: Server,
  socket: Socket,
  raw: unknown,
  ack?: Ack,
): Promise<void> {
  const st = getExam(socket);
  if (!st) {
    fail(ack, 'not_in_match');
    return;
  }
  if (socket.data.userId !== examinerIdOf(st)) {
    fail(ack, 'not_examiner');
    return;
  }
  if (st.completed || st.scores.some((s) => s.roundNumber === st.roundNumber)) {
    fail(ack, 'already_scored');
    return;
  }
  if (st.maxPart < 3) {
    fail(ack, 'part3_required');
    return;
  }
  const payload = raw as ScoreSubmitPayload | undefined;
  const band = payload?.band;
  if (
    typeof band !== 'number' ||
    !Number.isFinite(band) ||
    band < 0 ||
    band > 9 ||
    Math.abs(band * 2 - Math.round(band * 2)) > 1e-9
  ) {
    fail(ack, 'bad_band');
    return;
  }

  const roundId = await roundIdFor(st);
  if (!roundId) {
    fail(ack, 'internal');
    return;
  }
  const examinerId = examinerIdOf(st);
  const examineeId = examineeIdOf(st);
  const inserted = await insertScore({
    roundId,
    matchId: st.matchId,
    examineeId,
    examinerId,
    band,
  });
  if (!inserted) {
    fail(ack, 'already_scored');
    return;
  }
  await markRoundScored(roundId);

  const record: RoundScoreRecord = { roundNumber: st.roundNumber, band, examinerId, examineeId };
  st.scores.push(record);
  const scored: RoundScoredPayload = record;
  emitBoth(io, st, S2C.ROUND_SCORED, scored);

  if (st.roundNumber === 1) {
    await swapToRound2(io, st);
  } else {
    st.completed = true;
    await completeMatch(st.matchId);
    emitBoth(io, st, S2C.MATCH_COMPLETED, { rounds: st.scores });
  }
  ack?.({ ok: true });
}

async function swapToRound2(io: Server, st: ExamMatch): Promise<void> {
  const newExaminer = st.examineeR1;
  const newExaminee = st.examinerR1;
  await createRound({
    matchId: st.matchId,
    roundNumber: 2,
    examinerId: newExaminer,
    examineeId: newExaminee,
    questionSetId: st.setR2Id,
  });
  const roundId = await getRoundId(st.matchId, 2);
  if (roundId) st.roundIds.set(2, roundId);

  st.roundNumber = 2;
  st.ready.clear();
  st.part = 0;
  st.maxPart = 0;
  st.stage = null;
  st.cardOrdinal = null;
  st.set = await getSetPayload(st.setR2Id);

  const roundStart: RoundStartPayload = {
    roundNumber: 2,
    examinerId: newExaminer,
    examineeId: newExaminee,
    set: st.set,
  };
  emitBoth(io, st, S2C.ROUND_START, roundStart);
}

export function handleTimerPing(socket: Socket, raw: unknown): void {
  const clientTime = (raw as { clientTime?: unknown } | undefined)?.clientTime;
  socket.emit(S2C.TIMER_PONG, {
    clientTime: typeof clientTime === 'number' ? clientTime : 0,
    serverTime: Date.now(),
  });
}
