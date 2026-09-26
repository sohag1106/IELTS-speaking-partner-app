import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { connectSocket, disconnectSocket, emitAck } from '../lib/socket';
import { notePong } from '../lib/clock';
import {
  C2S,
  S2C,
  type MatchCompletedPayload,
  type MatchFoundPayload,
  type PartChangedPayload,
  type PeerMediaPayload,
  type PeerReadyPayload,
  type QuestionSetPayload,
  type Role,
  type RoundScoredPayload,
  type RoundStartPayload,
  type TimerEndPayload,
  type TimerPongPayload,
  type TimerStartPayload,
} from '../lib/events';
import { useIdentity } from './IdentityContext';
import type { Socket } from 'socket.io-client';

export interface MatchSession {
  matchId: string;
  code: string | null;
  peer: { id: string; nickname: string };
  role: Role;
  /** True for the round-1 examiner — this side sends the WebRTC offer. */
  caller: boolean;
  roundNumber: 1 | 2;
  examinerId: string;
  examineeId: string;
  set: QuestionSetPayload | null;
  part: 0 | 1 | 2 | 3;
  stage: 'prep' | 'talk' | 'ended' | null;
  card: { prompt: string; leadIn: string; bullets: string[] } | null;
  maxPart: number;
  timer: TimerStartPayload | null;
  scores: RoundScoredPayload[];
  completed: boolean;
  youReady: boolean;
  peerReady: boolean;
  peerMic: boolean;
  peerCam: boolean;
  peerDisconnected: boolean;
  peerLeft: boolean;
}

interface MatchState {
  connected: boolean;
  queueWaiting: boolean;
  session: MatchSession | null;
  error: string | null;
}

type Action =
  | { type: 'connected'; connected: boolean }
  | { type: 'queue_update'; waiting: boolean }
  | { type: 'match_found'; payload: MatchFoundPayload }
  | { type: 'round_start'; payload: RoundStartPayload; role: Role }
  | { type: 'peer_ready'; you: boolean }
  | { type: 'peer_media'; payload: PeerMediaPayload }
  | { type: 'part_changed'; payload: PartChangedPayload }
  | { type: 'timer_start'; payload: TimerStartPayload }
  | { type: 'timer_end'; payload: TimerEndPayload }
  | { type: 'round_scored'; payload: RoundScoredPayload }
  | { type: 'match_completed'; payload: MatchCompletedPayload }
  | { type: 'peer_disconnected' }
  | { type: 'match_left' }
  | { type: 'error'; message: string }
  | { type: 'reset' };

const initialState: MatchState = {
  connected: false,
  queueWaiting: false,
  session: null,
  error: null,
};

function sessionFrom(p: MatchFoundPayload): MatchSession {
  return {
    matchId: p.matchId,
    code: p.code,
    peer: p.peer,
    role: p.yourRole,
    caller: p.yourRole === 'examiner',
    roundNumber: 1,
    examinerId: '',
    examineeId: '',
    set: null,
    part: 0,
    stage: null,
    card: null,
    maxPart: 0,
    timer: null,
    scores: [],
    completed: false,
    youReady: false,
    peerReady: false,
    peerMic: false,
    peerCam: false,
    peerDisconnected: false,
    peerLeft: false,
  };
}

function reducer(state: MatchState, action: Action): MatchState {
  switch (action.type) {
    case 'connected':
      return { ...state, connected: action.connected };
    case 'queue_update':
      return { ...state, queueWaiting: action.waiting, error: null };
    case 'match_found':
      return { ...state, queueWaiting: false, error: null, session: sessionFrom(action.payload) };
    case 'round_start': {
      if (!state.session) return state;
      const p = action.payload;
      return {
        ...state,
        session: {
          ...state.session,
          roundNumber: p.roundNumber,
          role: action.role,
          examinerId: p.examinerId,
          examineeId: p.examineeId,
          set: p.set,
          part: 0,
          stage: null,
          card: null,
          maxPart: 0,
          timer: null,
          youReady: false,
          peerReady: false,
        },
      };
    }
    case 'peer_ready': {
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          youReady: action.you ? true : state.session.youReady,
          peerReady: action.you ? state.session.peerReady : true,
        },
      };
    }
    case 'peer_media': {
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          peerMic: action.payload.mic,
          peerCam: action.payload.cam,
        },
      };
    }
    case 'part_changed': {
      if (!state.session) return state;
      const p = action.payload;
      return {
        ...state,
        session: {
          ...state.session,
          part: p.part,
          stage: p.stage ?? null,
          card: p.card ?? null,
          maxPart: p.maxPart,
        },
      };
    }
    case 'timer_start': {
      if (!state.session) return state;
      return { ...state, session: { ...state.session, timer: action.payload } };
    }
    case 'timer_end': {
      if (!state.session) return state;
      if (state.session.timer && state.session.timer.id !== action.payload.id) return state;
      return { ...state, session: { ...state.session, timer: null } };
    }
    case 'round_scored': {
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          scores: [...state.session.scores, action.payload],
          timer: null,
        },
      };
    }
    case 'match_completed': {
      if (!state.session) return state;
      // payload rounds carry the authoritative final bands
      const scores: RoundScoredPayload[] = action.payload.rounds.map((r) => ({
        roundNumber: r.roundNumber,
        band: r.band,
        examinerId: r.examinerId,
        examineeId: r.examineeId,
      }));
      return { ...state, session: { ...state.session, completed: true, scores } };
    }
    case 'peer_disconnected': {
      if (!state.session) return state;
      return { ...state, session: { ...state.session, peerDisconnected: true } };
    }
    case 'match_left': {
      if (!state.session) return state;
      return { ...state, session: { ...state.session, peerLeft: true } };
    }
    case 'error':
      return { ...state, error: action.message, queueWaiting: false };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

interface MatchCtx {
  state: MatchState;
  socket: Socket | null;
  joinQueue: () => Promise<void>;
  leaveQueue: () => Promise<void>;
  createRoom: () => Promise<string>;
  joinRoom: (code: string) => Promise<void>;
  leaveMatch: () => void;
  markReady: () => Promise<void>;
  startPart: (part: 1 | 2 | 3, cardOrdinal?: number) => Promise<void>;
  hideNow: () => Promise<void>;
  submitScore: (band: number) => Promise<void>;
}

const Ctx = createContext<MatchCtx | null>(null);

export function MatchProvider({ children }: { children: ReactNode }) {
  const { identity } = useIdentity();
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!identity) {
      disconnectSocket();
      socketRef.current = null;
      dispatch({ type: 'reset' });
      return;
    }
    const sock = connectSocket(identity.token);
    socketRef.current = sock;

    const onConnect = () => dispatch({ type: 'connected', connected: true });
    const onDisconnect = () => dispatch({ type: 'connected', connected: false });
    const onQueue = (p: { waiting: boolean }) => dispatch({ type: 'queue_update', waiting: p.waiting });
    const onFound = (p: MatchFoundPayload) => dispatch({ type: 'match_found', payload: p });
    const onRound = (p: RoundStartPayload) =>
      dispatch({
        type: 'round_start',
        payload: p,
        role: p.examinerId === identity.userId ? 'examiner' : 'examinee',
      });
    const onPart = (p: PartChangedPayload) => dispatch({ type: 'part_changed', payload: p });
    const onTimerStart = (p: TimerStartPayload) => dispatch({ type: 'timer_start', payload: p });
    const onTimerEnd = (p: TimerEndPayload) => dispatch({ type: 'timer_end', payload: p });
    const onScored = (p: RoundScoredPayload) => dispatch({ type: 'round_scored', payload: p });
    const onCompleted = (p: MatchCompletedPayload) => dispatch({ type: 'match_completed', payload: p });
    const onPeerDown = () => dispatch({ type: 'peer_disconnected' });
    const onPeerLeft = () => dispatch({ type: 'match_left' });
    const onPeerReady = (p: PeerReadyPayload) =>
      dispatch({ type: 'peer_ready', you: p.userId === identity.userId });
    const onPeerMedia = (p: PeerMediaPayload) => dispatch({ type: 'peer_media', payload: p });
    const onPong = (p: TimerPongPayload) =>
      notePong(p.clientTime, p.serverTime, Date.now());
    const onError = (p: { message?: string }) =>
      dispatch({ type: 'error', message: p?.message ?? 'Something went wrong' });

    // Keep server/client clocks aligned for Part 2 countdowns.
    const pingIv = window.setInterval(() => {
      if (sock.connected) sock.emit(C2S.TIMER_PING, { clientTime: Date.now() });
    }, 10_000);
    if (sock.connected) sock.emit(C2S.TIMER_PING, { clientTime: Date.now() });

    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);
    sock.on(S2C.QUEUE_UPDATE, onQueue);
    sock.on(S2C.MATCH_FOUND, onFound);
    sock.on(S2C.ROUND_START, onRound);
    sock.on(S2C.PEER_READY, onPeerReady);
    sock.on(S2C.PEER_MEDIA, onPeerMedia);
    sock.on(S2C.PART_CHANGED, onPart);
    sock.on(S2C.TIMER_START, onTimerStart);
    sock.on(S2C.TIMER_END, onTimerEnd);
    sock.on(S2C.TIMER_PONG, onPong);
    sock.on(S2C.ROUND_SCORED, onScored);
    sock.on(S2C.MATCH_COMPLETED, onCompleted);
    sock.on(S2C.PEER_DISCONNECTED, onPeerDown);
    sock.on(S2C.MATCH_LEFT, onPeerLeft);
    sock.on(S2C.ERROR, onError);
    if (sock.connected) onConnect();

    return () => {
      window.clearInterval(pingIv);
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.off(S2C.QUEUE_UPDATE, onQueue);
      sock.off(S2C.MATCH_FOUND, onFound);
      sock.off(S2C.ROUND_START, onRound);
      sock.off(S2C.PEER_READY, onPeerReady);
      sock.off(S2C.PEER_MEDIA, onPeerMedia);
      sock.off(S2C.PART_CHANGED, onPart);
      sock.off(S2C.TIMER_START, onTimerStart);
      sock.off(S2C.TIMER_END, onTimerEnd);
      sock.off(S2C.TIMER_PONG, onPong);
      sock.off(S2C.ROUND_SCORED, onScored);
      sock.off(S2C.MATCH_COMPLETED, onCompleted);
      sock.off(S2C.PEER_DISCONNECTED, onPeerDown);
      sock.off(S2C.MATCH_LEFT, onPeerLeft);
      sock.off(S2C.ERROR, onError);
    };
  }, [identity]);

  const joinQueue = useCallback(async () => {
    const sock = socketRef.current;
    if (!sock) throw new Error('not connected');
    const res = await emitAck(sock, C2S.QUEUE_JOIN);
    if (!res.ok) throw new Error(res.error ?? 'failed');
  }, []);

  const leaveQueue = useCallback(async () => {
    const sock = socketRef.current;
    if (!sock) return;
    await emitAck(sock, C2S.QUEUE_LEAVE).catch(() => undefined);
  }, []);

  const createRoom = useCallback(async () => {
    const sock = socketRef.current;
    if (!sock) throw new Error('not connected');
    const res = await emitAck<{ ok: boolean; error?: string; code?: string }>(
      sock,
      C2S.ROOM_CREATE,
    );
    if (!res.ok || !res.code) throw new Error(res.error ?? 'failed');
    return res.code;
  }, []);

  const joinRoom = useCallback(async (code: string) => {
    const sock = socketRef.current;
    if (!sock) throw new Error('not connected');
    const res = await emitAck(sock, C2S.ROOM_JOIN, code);
    if (!res.ok) {
      if (res.error === 'not_found') throw new Error('No room with that code.');
      if (res.error === 'rate_limited')
        throw new Error('Too many attempts — wait a moment and try again.');
      throw new Error(res.error ?? 'failed');
    }
  }, []);

  const leaveMatch = useCallback(() => {
    const sock = socketRef.current;
    if (sock && socketRef.current) sock.emit(C2S.MATCH_LEAVE);
    dispatch({ type: 'reset' });
  }, []);

  const markReady = useCallback(async () => {
    const sock = socketRef.current;
    if (!sock) throw new Error('not connected');
    const res = await emitAck(sock, C2S.MATCH_READY);
    if (!res.ok) throw new Error(res.error ?? 'failed');
  }, []);

  const startPart = useCallback(async (part: 1 | 2 | 3, cardOrdinal?: number) => {
    const sock = socketRef.current;
    if (!sock) throw new Error('not connected');
    const res = await emitAck(sock, C2S.PART_START, { part, cardOrdinal });
    if (!res.ok) throw new Error(res.error ?? 'failed');
  }, []);

  const hideNow = useCallback(async () => {
    const sock = socketRef.current;
    if (!sock) throw new Error('not connected');
    const res = await emitAck(sock, C2S.PART2_HIDE_NOW);
    if (!res.ok) throw new Error(res.error ?? 'failed');
  }, []);

  const submitScore = useCallback(async (band: number) => {
    const sock = socketRef.current;
    if (!sock) throw new Error('not connected');
    const res = await emitAck(sock, C2S.SCORE_SUBMIT, { band });
    if (!res.ok) throw new Error(res.error ?? 'failed');
  }, []);

  const value = useMemo(
    () => ({
      state,
      socket: socketRef.current,
      joinQueue,
      leaveQueue,
      createRoom,
      joinRoom,
      leaveMatch,
      markReady,
      startPart,
      hideNow,
      submitScore,
    }),
    [state, joinQueue, leaveQueue, createRoom, joinRoom, leaveMatch, markReady, startPart, hideNow, submitScore],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMatch(): MatchCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMatch must be used within MatchProvider');
  return ctx;
}
