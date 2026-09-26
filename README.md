# IELTS Speaking Partner

Omegle-style 1:1 video practice for the IELTS Speaking test. Two people pair up
randomly (or with a friend via a room code), run a full 3-part speaking test
over P2P video, then swap roles and do it again — so each player is examined
once and examines once per match. Every test is scored on the 0–9 IELTS band
(half bands), and your average band shows up on your profile.

## How it works

- **Match** — queue for a random partner or create/join a 6-character room code.
- **Two rounds, auto-swap** — round 1: you examiner / peer examinee; round 2:
  roles flip in the same room with a different question set.
- **Exam flow** — Part 1 interview → Part 2 cue card (60 s prep + 120 s talk,
  server-timed; the card disappears when time is up or the examiner hides it)
  → Part 3 discussion → score out of 9.
- **Examiner UI** — the examiner sees the questions for all three parts drawn
  from a pre-loaded 100-question bank (10 topic sets × 10 items).
- **Examinee UI** — the cue card appears for one minute like the real test,
  then vanishes; a local scratchpad lets you jot notes on screen (or use pen
  and paper).
- **Scores** — raw bands stored per round; profile shows `ROUND(AVG(band),1)`
  plus received/given history.
- **Disconnect = abandon** — leave mid-match and the match is abandoned with
  no scores recorded (no resume in the MVP).

## Stack

| Layer | Tech |
|---|---|
| Server | Node.js + Express + Socket.IO + TypeScript (`tsx watch`), plain `pg` |
| Database | Postgres (Neon in dev) — identity, 100-question bank, matches, scores |
| Client | React 18 + Vite + TypeScript + react-router |
| Video | P2P WebRTC (one peer connection persists across the role swap) |
| Monorepo | npm workspaces: root + `/server` + `/client` |

## Quick start

```bash
npm install
```

1. **Database** — copy `server/.env.example` to `server/.env` and set
   `DATABASE_URL` to your Postgres/Neon connection string:

   ```
   DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
   PORT=3001
   ```

2. **Schema + questions**:

   ```bash
   npm run db:migrate
   npm run db:seed     # loads the 100 IELTS questions
   ```

3. **Run**:

   ```bash
   npm run dev         # server :3001 + client :5173
   ```

   Open http://localhost:5173 in two browser windows (or normal + Incognito)
   to test with two identities. Health check: http://localhost:3001/api/health

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev servers with hot reload (HTTP) |
| `npm run dev:https` | Same, but client over HTTPS (required for phones on LAN) |
| `npm run build` | Typecheck both workspaces + production client build |
| `npm run db:migrate` | Apply `server/src/db/schema.sql` |
| `npm run db:seed` | Seed the 100-question bank (idempotent) |
| `node scripts/smoke-match.mjs` | Matchmaking + signaling smoke tests |
| `node scripts/smoke-exam.mjs` | Full 2-round exam protocol tests |
| `node scripts/webrtc-check.mjs` | Headless two-page A/V + full-exam E2E |

(The smoke/E2E scripts need `npm run dev` running; `webrtc-check` uses local
Chrome/Edge with fake media devices.)

## Testing on a phone (LAN)

`getUserMedia` (camera/mic) only works in a **secure context** — `localhost`
counts, but `http://192.168.x.x:5173` does not. Pick one:

1. **HTTPS dev server (recommended)**

   ```bash
   npm run dev:https
   ```

   The client comes up on `https://<your-LAN-IP>:5173` with a self-signed
   certificate. Your phone will warn about it — tap *Advanced → Proceed*.
   (Vite's `host: true` already listens on the LAN; find your IP with
   `ipconfig` / `ip addr`.)

2. **Chrome flag instead** — on the phone open
   `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add
   `http://<your-LAN-IP>:5173`, enable, relaunch. No cert needed.

## Production notes (please read before deploying)

- **TURN is mandatory.** The dev config (`GET /api/config`) ships Google STUN
  plus a public Open Relay TURN — fine for testing, **not for production**
  (rate-limited, unreliable, not yours). Real deployments behind NATs/symmetric
  NAT need your own TURN:
  - self-host [coturn](https://github.com/coturn/coturn), or
  - use a hosted service (Metered, Twilio, etc.),
  then set `STUN_URL`, `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` in the
  server environment.
- **HTTPS everywhere** — cameras require it; terminate TLS in front of the
  client (and keep the Socket.IO proxy on the same origin).
- **State is in-memory** — match/queue state lives in the server process; a
  restart abandons active matches (there's a boot sweep that marks orphans
  `abandoned`). Fine for MVP; needs Redis/DB-backed state to scale horizontally.
- **Guest identity** — nickname → opaque bearer token (sha256 at rest). No
  passwords yet; anyone who has the token is the user. Don't treat scores as
  strongly authenticated.
- Room codes are 6 characters (~31-char alphabet) with a per-user rate limit;
  they're for friends, not secrets.

## Environment variables (`server/.env`)

| Var | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string (required) |
| `PORT` | `3001` | API + Socket.IO port |
| `PART2_PREP_SECONDS` | `60` | Cue-card prep time |
| `PART2_TALK_SECONDS` | `120` | Cue-card speaking time |
| `STUN_URL` | Google STUN | STUN server |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | Open Relay | TURN server (replace for prod) |

## Project layout

```
server/src/
  index.ts, env.ts
  db/            pool, schema, migrate, seed, 100-question bank, repos
  routes/        auth (guest), me (profile+stats), config (ICE), health
  socket/        protocol (event source of truth), matchmaking,
                 matchState (exam state machine), signaling (WebRTC relay)
  util/          room codes, token hashing, rate limiter
client/src/
  pages/         Home (lobby), Match (room/:matchId), Profile
  components/    ReadyGate, ExaminerPanel, ExamineePanel, CueCardView,
                 VideoStage/Tile, MediaControls, ScoreDialog, ResultsView, ...
  hooks/         useMedia, useWebRTC, useServerTimer, useWakeLock
  state/         IdentityContext, MatchContext (server-state mirror)
```
