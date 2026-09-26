import type { Server, Socket } from 'socket.io';
import { findByTokenHash } from '../db/repos/usersRepo.js';
import { hashToken } from '../util/token.js';
import { C2S } from './protocol.js';
import {
  handleDisconnect,
  handleMatchLeave,
  handleQueueJoin,
  handleQueueLeave,
  handleRoomCreate,
  handleRoomJoin,
} from './matchmaking.js';
import {
  handleHideNow,
  handleMatchReady,
  handlePartStart,
  handleSubmitScore,
  handleTimerPing,
} from './matchState.js';
import { handleIceRelay, handleMediaState, handleSignalRelay } from './signaling.js';

type Ack = (res: { ok: boolean; error?: string; code?: string }) => void;

export function initSocket(io: Server): void {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) {
        next(new Error('unauthorized'));
        return;
      }
      const user = await findByTokenHash(hashToken(token));
      if (!user) {
        next(new Error('unauthorized'));
        return;
      }
      socket.data.userId = user.id;
      socket.data.nickname = user.nickname;
      socket.data.zone = 'idle';
      next();
    } catch (err) {
      console.error('[socket] auth error:', err);
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] ${socket.data.nickname} (${socket.data.userId}) connected`);

    socket.on(C2S.QUEUE_JOIN, (ack?: Ack) => {
      handleQueueJoin(io, socket, ack).catch((err) => {
        console.error('[socket] queue:join error:', err);
        ack?.({ ok: false, error: 'internal' });
      });
    });

    socket.on(C2S.QUEUE_LEAVE, (ack?: Ack) => handleQueueLeave(socket, ack));

    socket.on(C2S.ROOM_CREATE, (ack?: Ack) => handleRoomCreate(socket, ack));

    socket.on(C2S.ROOM_JOIN, (code: unknown, ack?: Ack) => {
      handleRoomJoin(io, socket, code, ack).catch((err) => {
        console.error('[socket] room:join error:', err);
        ack?.({ ok: false, error: 'internal' });
      });
    });

    socket.on(C2S.MATCH_LEAVE, () => {
      handleMatchLeave(io, socket).catch((err) => {
        console.error('[socket] match:leave error:', err);
      });
    });

    socket.on(C2S.MATCH_READY, (ack?: Ack) => {
      try {
        handleMatchReady(io, socket, ack);
      } catch (err) {
        console.error('[socket] match:ready error:', err);
        ack?.({ ok: false, error: 'internal' });
      }
    });

    socket.on(C2S.PART_START, (payload: unknown, ack?: Ack) => {
      handlePartStart(io, socket, payload, ack).catch((err) => {
        console.error('[socket] part:start error:', err);
        ack?.({ ok: false, error: 'internal' });
      });
    });

    socket.on(C2S.PART2_HIDE_NOW, (ack?: Ack) => {
      try {
        handleHideNow(io, socket, ack);
      } catch (err) {
        console.error('[socket] part2:hide_now error:', err);
        ack?.({ ok: false, error: 'internal' });
      }
    });

    socket.on(C2S.SCORE_SUBMIT, (payload: unknown, ack?: Ack) => {
      handleSubmitScore(io, socket, payload, ack).catch((err) => {
        console.error('[socket] score:submit error:', err);
        ack?.({ ok: false, error: 'internal' });
      });
    });

    socket.on(C2S.TIMER_PING, (payload: unknown) => {
      handleTimerPing(socket, payload);
    });

    socket.on(C2S.WEBRTC_OFFER, (payload: unknown) => {
      handleSignalRelay(io, socket, C2S.WEBRTC_OFFER, payload);
    });

    socket.on(C2S.WEBRTC_ANSWER, (payload: unknown) => {
      handleSignalRelay(io, socket, C2S.WEBRTC_ANSWER, payload);
    });

    socket.on(C2S.WEBRTC_ICE, (payload: unknown) => {
      handleIceRelay(io, socket, payload);
    });

    socket.on(C2S.MEDIA_STATE, (payload: unknown) => {
      handleMediaState(io, socket, payload);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] ${socket.data.nickname} disconnected`);
      handleDisconnect(io, socket).catch((err) => {
        console.error('[socket] disconnect cleanup error:', err);
      });
    });
  });
}
