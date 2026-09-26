import { Router } from 'express';
import { findByTokenHash, getProfileStats } from '../db/repos/usersRepo.js';
import { hashToken } from '../util/token.js';

export const meRouter = Router();

meRouter.get('/', async (req, res) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = token ? await findByTokenHash(hashToken(token)) : null;
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const profile = await getProfileStats(user.id);
  res.json({ userId: user.id, nickname: user.nickname, ...profile });
});
