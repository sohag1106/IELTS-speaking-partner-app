import { Router } from 'express';
import { env } from '../env.js';
import { getTurnExpiresAt, getTurnIceServers } from '../util/turnCredentials.js';

export const configRouter = Router();

configRouter.get('/', async (_req, res) => {
  // TURN entries come from Cloudflare's short-lived credentials and/or a
  // static TURN_URL; empty when neither is configured (STUN only).
  let turn: Awaited<ReturnType<typeof getTurnIceServers>> = [];
  try {
    turn = await getTurnIceServers();
  } catch (err) {
    console.warn('[config] TURN lookup failed:', err);
  }
  res.json({
    iceServers: [{ urls: env.stunUrl }, ...turn],
    turnExpiresAt: getTurnExpiresAt(),
    part2: {
      prepSeconds: env.part2PrepSeconds,
      talkSeconds: env.part2TalkSeconds,
    },
  });
});
