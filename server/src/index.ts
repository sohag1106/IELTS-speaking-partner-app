import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { env } from './env.js';
import { authRouter } from './routes/auth.js';
import { configRouter } from './routes/config.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { initSocket } from './socket/index.js';
import { abandonOrphanedMatches } from './db/repos/matchesRepo.js';

const app = express();
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/auth/guest', authRouter);
app.use('/api/me', meRouter);
app.use('/api/config', configRouter);

// Production: serve the built client from the same origin as the API/socket
// (https://<host>/ works for API, Socket.IO and WebRTC with one TLS cert).
// Skipped in dev — `client/dist` then only exists after a local `npm run build`.
const distDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../client/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback for client routes (/profile, /room/:matchId); APIs 404 normally.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: 'internal_error' });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

initSocket(io);

// In-memory match state does not survive a restart — close any rows left open.
void abandonOrphanedMatches().catch((err) => console.error('[db] boot sweep failed:', err));

httpServer.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
});
