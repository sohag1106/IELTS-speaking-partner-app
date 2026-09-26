import { Router } from 'express';
import { env } from '../env.js';

export const configRouter = Router();

configRouter.get('/', (_req, res) => {
  res.json({
    iceServers: [
      { urls: env.stunUrl },
      {
        urls: env.turnUrl,
        username: env.turnUsername,
        credential: env.turnCredential,
      },
    ],
    part2: {
      prepSeconds: env.part2PrepSeconds,
      talkSeconds: env.part2TalkSeconds,
    },
  });
});
