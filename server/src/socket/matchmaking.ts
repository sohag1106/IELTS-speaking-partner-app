import type { Server, Socket } from 'socket.io';
import { generateRoomCode, normalizeRoomCode } from '../util/code.js';
import { allow } from '../util/rateLimit.js';
import { getSetPayload, randomDistinctSetIds } from '../db/repos/questionsRepo.js';
import { abandonMatch, createMatch } from '../db/repos/matchesRepo.js';
import { clearMatchState, initMatchState } from './matchState.js';
import { C2S, S2C, type MatchFoundPayload, type RoundStartPayload } from './protocol.js';

export interface Player {
  userId: string;
  nickname: string;
  socketId: string;
}

export interface LiveMatch {
  matchId: string;
  code: string | null;
  examinerR1: Player;
  examineeR1: Player;
  setR1Id: string;
  setR2Id: string;
}

const queue: Player[] = [];
const pendingRooms = new Map<string, Player>(); // code → host
export const liveMatches = new Map<string, LiveMatch>();

type Ack = (res: { ok: boolean; error?: string; code?: string }) => void;

function playerOf(socket: Socket): Player {
  return {
    userId: socket.data.userId,
    nickname: socket.data.nickname,
    socketId: socket.id,
  };
}

function fail(ack: Ack | undefined, error: string): void {
  ack?.({ ok: false, error });
}

/** Reset a socket's session zone (used when match creation falls apart). */
function releaseSocket(s: Socket | undefined): void {
  if (!s) return;
  s.data.zone = 'idle';
  s.data.matchId = undefined;
  s.data.pendingCode = undefined;
}

/** Create the match rows, remember it in memory, notify both players.
 *  Returns false when a player vanished mid-creation (match rolled back). */
async function createAndAnnounce(
  io: Server,
  a: Player,
  b: Player,
  code: string | null,
  createdBy: string | null,
): Promise<boolean> {
  const setIds = await randomDistinctSetIds(2);
  const setR1Id = setIds[0];
  const setR2Id = setIds[1] ?? setIds[0];

  const matchId = await createMatch({
    code,
    createdBy,
    examinerR1: a.userId,
    examineeR1: b.userId,
    setR1: setR1Id,
    setR2: setR2Id,
  });

  // The row exists now. Register the match in ONE synchronous step so a
  // disconnect interleaved between the awaits can never strand an active row.
  const sa = io.sockets.sockets.get(a.socketId);
  const sb = io.sockets.sockets.get(b.socketId);
  if (!sa || !sb) {
    // A player vanished while the row was being created — undo it.
    await abandonMatch(matchId);
    releaseSocket(sa);
    releaseSocket(sb);
    sa?.emit(S2C.QUEUE_UPDATE, { waiting: false, position: 0 });
    sb?.emit(S2C.QUEUE_UPDATE, { waiting: false, position: 0 });
    console.log(`[match] ${matchId} aborted (player left during creation)`);
    return false;
  }

  sa.data.zone = 'in_match';
  sa.data.matchId = matchId;
  sb.data.zone = 'in_match';
  sb.data.matchId = matchId;
  liveMatches.set(matchId, {
    matchId,
    code,
    examinerR1: a,
    examineeR1: b,
    setR1Id,
    setR2Id,
  });

  try {
    const setPayload = await getSetPayload(setR1Id);
    if (!liveMatches.has(matchId)) {
      // Torn down (leave/disconnect) while loading the set — nothing to announce.
      return false;
    }
    initMatchState({
      matchId,
      examinerR1: a.userId,
      examineeR1: b.userId,
      socketIds: [a.socketId, b.socketId],
      setR1: setPayload,
      setR2Id,
    });
    const roundStart: RoundStartPayload = {
      roundNumber: 1,
      examinerId: a.userId,
      examineeId: b.userId,
      set: setPayload,
    };

    const foundA: MatchFoundPayload = {
      matchId,
      code,
      peer: { id: b.userId, nickname: b.nickname },
      yourRole: 'examiner',
    };
    const foundB: MatchFoundPayload = {
      matchId,
      code,
      peer: { id: a.userId, nickname: a.nickname },
      yourRole: 'examinee',
    };

    io.to(a.socketId).emit(S2C.MATCH_FOUND, foundA);
    io.to(a.socketId).emit(S2C.ROUND_START, roundStart);
    io.to(b.socketId).emit(S2C.MATCH_FOUND, foundB);
    io.to(b.socketId).emit(S2C.ROUND_START, roundStart);
  } catch (err) {
    // Registered but failed to load the question set — roll the whole thing back.
    console.error('[match] announce failed:', err);
    liveMatches.delete(matchId);
    clearMatchState(matchId);
    await abandonMatch(matchId);
    releaseSocket(sa);
    releaseSocket(sb);
    sa.emit(S2C.QUEUE_UPDATE, { waiting: false, position: 0 });
    sb.emit(S2C.QUEUE_UPDATE, { waiting: false, position: 0 });
    return false;
  }

  console.log(`[match] ${matchId} created (code=${code ?? 'queue'}, R1 examiner=${a.nickname})`);
  return true;
}

/** Pair up whoever is waiting. */
async function tryMatch(io: Server): Promise<void> {
  while (queue.length >= 2) {
    const a = queue.shift()!;
    const b = queue.shift()!;
    // Reserve both sockets up front: leave/join/queue must not interleave
    // while the DB insert is in flight (matchId is filled in on registration).
    for (const p of [a, b]) {
      const s = io.sockets.sockets.get(p.socketId);
      if (s) {
        s.data.zone = 'in_match';
        s.data.matchId = undefined;
      }
    }
    try {
      await createAndAnnounce(io, a, b, null, null);
    } catch (err) {
      console.error('[match] create failed:', err);
      for (const p of [a, b]) {
        const s = io.sockets.sockets.get(p.socketId);
        releaseSocket(s);
        s?.emit(S2C.QUEUE_UPDATE, { waiting: false, position: 0 });
      }
    }
  }
}

export async function handleQueueJoin(io: Server, socket: Socket, ack?: Ack): Promise<void> {
  if (socket.data.zone !== 'idle') {
    fail(ack, 'already_in_session');
    return;
  }
  socket.data.zone = 'queued';
  queue.push(playerOf(socket));
  ack?.({ ok: true });

  if (queue.length === 1) {
    socket.emit(S2C.QUEUE_UPDATE, { waiting: true, position: 1 });
  }
  await tryMatch(io);
}

export function handleQueueLeave(socket: Socket, ack?: Ack): void {
  if (socket.data.zone !== 'queued') {
    fail(ack, 'not_queued');
    return;
  }
  const idx = queue.findIndex((p) => p.socketId === socket.id);
  if (idx >= 0) queue.splice(idx, 1);
  socket.data.zone = 'idle';
  ack?.({ ok: true });
  socket.emit(S2C.QUEUE_UPDATE, { waiting: false, position: 0 });
}

export function handleRoomCreate(socket: Socket, ack?: Ack): void {
  if (socket.data.zone !== 'idle') {
    fail(ack, 'already_in_session');
    return;
  }
  let code = generateRoomCode();
  while (pendingRooms.has(code)) code = generateRoomCode();
  pendingRooms.set(code, playerOf(socket));
  socket.data.zone = 'pending_room';
  socket.data.pendingCode = code;
  ack?.({ ok: true, code });
}

export async function handleRoomJoin(
  io: Server,
  socket: Socket,
  rawCode: unknown,
  ack?: Ack,
): Promise<void> {
  if (socket.data.zone !== 'idle') {
    fail(ack, 'already_in_session');
    return;
  }
  // 6-char codes are guessable — cap attempts per user.
  if (!allow(`room_join:${socket.data.userId}`, 8, 10_000)) {
    fail(ack, 'rate_limited');
    return;
  }
  if (typeof rawCode !== 'string') {
    fail(ack, 'bad_code');
    return;
  }
  const code = normalizeRoomCode(rawCode);
  const host = pendingRooms.get(code);
  if (!host) {
    fail(ack, 'not_found');
    return;
  }
  if (host.userId === socket.data.userId) {
    fail(ack, 'own_code');
    return;
  }
  pendingRooms.delete(code);
  const hostSocket = io.sockets.sockets.get(host.socketId);
  // Reserve both sockets before the async create so neither can sneak into
  // another queue/room while the match row is still being written.
  if (hostSocket) {
    hostSocket.data.zone = 'in_match';
    hostSocket.data.matchId = undefined;
    hostSocket.data.pendingCode = undefined;
  }
  socket.data.zone = 'in_match';
  socket.data.matchId = undefined;
  const created = await createAndAnnounce(io, host, playerOf(socket), code, host.userId);
  if (!created) {
    fail(ack, 'not_found'); // peer vanished mid-join; code was consumed already
    return;
  }
  ack?.({ ok: true });
}

/** Explicit leave — results screen or bailing out mid-match. */
export async function handleMatchLeave(io: Server, socket: Socket): Promise<void> {
  // Clear in-memory state first so a quick requeue can never see a stale zone.
  const matchId = socket.data.matchId;
  socket.data.matchId = undefined;
  socket.data.zone = 'idle';
  socket.data.pendingCode = undefined;

  if (!matchId) return;
  const match = liveMatches.get(matchId);
  if (!match) return;

  liveMatches.delete(matchId);
  clearMatchState(matchId);
  const other =
    match.examinerR1.socketId === socket.id ? match.examineeR1 : match.examinerR1;
  io.to(other.socketId).emit(S2C.MATCH_LEFT, { byUserId: socket.data.userId });
  // Release the peer too, so they can requeue without needing their own leave.
  const peerSocket = io.sockets.sockets.get(other.socketId);
  if (peerSocket) {
    peerSocket.data.zone = 'idle';
    peerSocket.data.matchId = undefined;
    peerSocket.data.pendingCode = undefined;
  }
  // No-op when the match already completed (guarded by status = 'active').
  await abandonMatch(matchId);
}

/** Cleanup when a socket disappears (tab close, refresh, network drop). */
export async function handleDisconnect(io: Server, socket: Socket): Promise<void> {
  const zone = socket.data.zone;

  if (zone === 'queued') {
    const idx = queue.findIndex((p) => p.socketId === socket.id);
    if (idx >= 0) queue.splice(idx, 1);
    return;
  }

  if (zone === 'pending_room' && socket.data.pendingCode) {
    pendingRooms.delete(socket.data.pendingCode);
    return;
  }

  if (zone === 'in_match' && socket.data.matchId) {
    const matchId = socket.data.matchId;
    const match = liveMatches.get(matchId);
    if (match) {
      liveMatches.delete(matchId);
      clearMatchState(matchId);
      await abandonMatch(matchId);
      const other =
        match.examinerR1.socketId === socket.id ? match.examineeR1 : match.examinerR1;
      io.to(other.socketId).emit(S2C.PEER_DISCONNECTED, {});
      // Release the survivor so they can requeue or join another room right away.
      const survivor = io.sockets.sockets.get(other.socketId);
      if (survivor) {
        survivor.data.zone = 'idle';
        survivor.data.matchId = undefined;
        survivor.data.pendingCode = undefined;
      }
      console.log(`[match] ${matchId} abandoned (disconnect)`);
    }
  }
}

// re-export for wiring
export { C2S, S2C };
export type { Ack };
