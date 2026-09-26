import type { Server, Socket } from 'socket.io';
import { liveMatches } from './matchmaking.js';
import {
  S2C,
  type PeerMediaPayload,
  type WebRTCDescriptionPayload,
  type WebRTCIcePayload,
} from './protocol.js';

/**
 * WebRTC signaling relay — the server only forwards SDP/ICE between the two
 * players of a live match; it never touches the media itself.
 */

/** Resolve the other player's socket id, or null when not in a live match. */
function peerSocketId(socket: Socket): string | null {
  const matchId = socket.data.matchId;
  if (socket.data.zone !== 'in_match' || !matchId) return null;
  const match = liveMatches.get(matchId);
  if (!match) return null;
  return match.examinerR1.socketId === socket.id
    ? match.examineeR1.socketId
    : match.examinerR1.socketId;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Forward a WebRTC offer/answer to the peer (drops junk silently). */
export function handleSignalRelay(
  io: Server,
  socket: Socket,
  event: 'webrtc:offer' | 'webrtc:answer',
  payload: unknown,
): void {
  try {
    if (!isObject(payload)) return;
    const description = (payload as { description?: unknown }).description;
    if (!isObject(description)) return;
    const type = description.type;
    if (type !== 'offer' && type !== 'answer') return;
    const to = peerSocketId(socket);
    if (!to) return;
    io.to(to).emit(event, { description } as WebRTCDescriptionPayload);
  } catch (err) {
    console.error('[signal] relay failed:', err);
  }
}

/** Forward an ICE candidate to the peer (drops junk silently). */
export function handleIceRelay(io: Server, socket: Socket, payload: unknown): void {
  try {
    if (!isObject(payload)) return;
    if (!('candidate' in payload)) return;
    const candidate = payload.candidate;
    if (candidate !== null && !isObject(candidate)) return;
    const to = peerSocketId(socket);
    if (!to) return;
    io.to(to).emit(S2C.WEBRTC_ICE, { candidate } as WebRTCIcePayload);
  } catch (err) {
    console.error('[signal] ice relay failed:', err);
  }
}

/** Validate mic/cam booleans and notify the peer of our media state. */
export function handleMediaState(io: Server, socket: Socket, payload: unknown): void {
  try {
    const to = peerSocketId(socket);
    if (!to) return;
    const p = isObject(payload) ? (payload as Partial<PeerMediaPayload>) : null;
    io.to(to).emit(S2C.PEER_MEDIA, {
      mic: p?.mic === true,
      cam: p?.cam === true,
    } satisfies PeerMediaPayload);
  } catch (err) {
    console.error('[signal] media state failed:', err);
  }
}
