import { query } from '../pool.js';

export interface UserRow {
  id: string; // BIGINT comes back as string
  nickname: string;
  auth_token_hash: string;
}

/** Drop control chars, zero-width and bidi marks; fold whitespace; cap length. */
export function sanitizeNickname(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) continue; // C0 + C1 controls
    if (code === 0x200b || code === 0x200c || code === 0x200d || code === 0x2060) continue; // zero-width
    if (code >= 0x202a && code <= 0x202e) continue; // bidi embedding/override
    if (code >= 0x2066 && code <= 0x2069) continue; // bidi isolates
    out += ch;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, 24);
}

export async function createUser(nickname: string, tokenHash: string): Promise<UserRow> {
  const res = await query<UserRow>(
    `INSERT INTO users (nickname, auth_token_hash)
     VALUES ($1, $2)
     RETURNING id, nickname, auth_token_hash`,
    [nickname, tokenHash],
  );
  return res.rows[0];
}

export async function findByTokenHash(tokenHash: string): Promise<UserRow | null> {
  const res = await query<UserRow>(
    `SELECT id, nickname, auth_token_hash FROM users WHERE auth_token_hash = $1`,
    [tokenHash],
  );
  return res.rows[0] ?? null;
}

export async function getProfileStats(userId: string): Promise<{
  stats: { count: number; avgBand: number | null };
  received: {
    band: number;
    examinerNickname: string;
    roundNumber: number;
    createdAt: string;
  }[];
  given: {
    band: number;
    examineeNickname: string;
    createdAt: string;
  }[];
}> {
  // count(*)::int is parsed to a number by pg; ROUND(... ) numeric stays a string.
  const summary = await query<{ count: number; avg: string | null }>(
    `SELECT count(*)::int AS count, ROUND(AVG(s.band), 1) AS avg
     FROM scores s WHERE s.examinee_id = $1`,
    [userId],
  );
  const received = await query<{
    band: string;
    examiner_nickname: string;
    round_number: number;
    created_at: Date;
  }>(
    `SELECT s.band, u.nickname AS examiner_nickname, s.created_at, r.round_number
     FROM scores s
     JOIN users u ON u.id = s.examiner_id
     JOIN rounds r ON r.id = s.round_id
     WHERE s.examinee_id = $1
     ORDER BY s.created_at DESC
     LIMIT 50`,
    [userId],
  );
  const given = await query<{ band: string; examinee_nickname: string; created_at: Date }>(
    `SELECT s.band, u.nickname AS examinee_nickname, s.created_at
     FROM scores s
     JOIN users u ON u.id = s.examinee_id
     WHERE s.examiner_id = $1
     ORDER BY s.created_at DESC
     LIMIT 50`,
    [userId],
  );

  const avg = summary.rows[0]?.avg;
  return {
    stats: {
      count: summary.rows[0]?.count ?? 0,
      avgBand: avg === null || avg === undefined ? null : Number(avg),
    },
    received: received.rows.map((r) => ({
      band: Number(r.band),
      examinerNickname: r.examiner_nickname,
      roundNumber: r.round_number,
      createdAt: r.created_at.toISOString(),
    })),
    given: given.rows.map((r) => ({
      band: Number(r.band),
      examineeNickname: r.examinee_nickname,
      createdAt: r.created_at.toISOString(),
    })),
  };
}
