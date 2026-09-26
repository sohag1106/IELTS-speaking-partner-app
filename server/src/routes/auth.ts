import { Router } from 'express';
import { createUser, sanitizeNickname } from '../db/repos/usersRepo.js';
import { generateToken, hashToken } from '../util/token.js';
import { allow } from '../util/rateLimit.js';

export const authRouter = Router();

authRouter.post('/', async (req, res) => {
  // Guest accounts are cheap to mint — keep one IP from flooding the users
  // table. Loopback is exempt so local smoke tests can create users freely.
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const loopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (!loopback && !allow(`guest:${ip}`, 10, 60_000)) {
    res.status(429).json({ error: 'Too many attempts — try again in a minute.' });
    return;
  }
  const raw = typeof req.body?.nickname === 'string' ? req.body.nickname : '';
  const nickname = sanitizeNickname(raw);
  if (nickname.length < 2 || nickname.length > 24) {
    res.status(400).json({ error: 'Nickname must be 2–24 characters.' });
    return;
  }
  const token = generateToken();
  const user = await createUser(nickname, hashToken(token));
  res.json({ userId: user.id, nickname: user.nickname, token });
});
