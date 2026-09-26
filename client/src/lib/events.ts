/**
 * Mirror of server/src/socket/protocol.ts (SOURCE OF TRUTH).
 * Keep the two files in sync.
 */

export const C2S = {
  QUEUE_JOIN: 'queue:join',
  QUEUE_LEAVE: 'queue:leave',
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  MATCH_READY: 'match:ready',
  PART_START: 'part:start',
  PART2_HIDE_NOW: 'part2:hide_now',
  SCORE_SUBMIT: 'score:submit',
  MATCH_LEAVE: 'match:leave',
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE: 'webrtc:ice',
  MEDIA_STATE: 'media:state',
  TIMER_PING: 'timer:ping',
} as const;

export const S2C = {
  QUEUE_UPDATE: 'queue:update',
  MATCH_FOUND: 'match:found',
  ROUND_START: 'round:start',
  PEER_READY: 'peer:ready',
  PART_CHANGED: 'part:changed',
  TIMER_START: 'timer:start',
  TIMER_END: 'timer:end',
  TIMER_PONG: 'timer:pong',
  ROUND_SCORED: 'round:scored',
  MATCH_COMPLETED: 'match:completed',
  PEER_MEDIA: 'peer:media',
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_ICE: 'webrtc:ice',
  PEER_DISCONNECTED: 'peer:disconnected',
  MATCH_LEFT: 'match:left',
  ERROR: 'error',
} as const;

export type Role = 'examiner' | 'examinee';

export interface PeerInfo {
  id: string;
  nickname: string;
}

export interface QuestionSetPayload {
  id: string;
  slug: string;
  title: string;
  part1: { prompt: string }[];
  part2: { ordinal: number; prompt: string; leadIn: string; bullets: string[] }[];
  part3: { prompt: string }[];
}

export interface MatchFoundPayload {
  matchId: string;
  code: string | null;
  peer: PeerInfo;
  yourRole: Role;
}

export interface RoundStartPayload {
  roundNumber: 1 | 2;
  examinerId: string;
  examineeId: string;
  set: QuestionSetPayload;
}

export interface PartChangedPayload {
  roundNumber: 1 | 2;
  part: 0 | 1 | 2 | 3;
  stage?: 'prep' | 'talk' | 'ended';
  card?: { prompt: string; leadIn: string; bullets: string[] } | null;
  maxPart: number;
}

export interface TimerStartPayload {
  id: string;
  label: 'part2_prep' | 'part2_talk';
  endsAt: number; // epoch ms, server clock
  durationSec: number;
}

export interface TimerEndPayload {
  id: string;
  label: string;
}

export interface RoundScoredPayload {
  roundNumber: 1 | 2;
  band: number;
  examinerId: string;
  examineeId: string;
}

export interface MatchCompletedPayload {
  rounds: { roundNumber: 1 | 2; band: number; examinerId: string; examineeId: string }[];
}

export interface PeerReadyPayload {
  userId: string;
}

export interface PartStartPayload {
  part: 1 | 2 | 3;
  cardOrdinal?: number;
}

export interface ScoreSubmitPayload {
  band: number;
}

export interface TimerPingPayload {
  clientTime: number;
}

export interface TimerPongPayload {
  clientTime: number;
  serverTime: number;
}

export interface PeerMediaPayload {
  mic: boolean;
  cam: boolean;
}

/** SDP description relayed between match peers (offer or answer). */
export interface WebRTCDescriptionPayload {
  description: RTCSessionDescriptionInit;
}

/** ICE candidate relayed between match peers (null = end of candidates). */
export interface WebRTCIcePayload {
  candidate: RTCIceCandidateInit | null;
}

export interface ErrorPayload {
  code: string;
  message: string;
}
