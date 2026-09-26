import http from 'node:http';
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
