import { query, pool } from '../pool.js';

export async function createMatch(opts: {
  code: string | null;
  createdBy: string | null;
  examinerR1: string;
  examineeR1: string;
  setR1: string;
  setR2: string;
}): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const matchRes = await client.query<{ id: string }>(
      `INSERT INTO matches (code, created_by, examiner_r1, examinee_r1, question_set_r1, question_set_r2)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [opts.code, opts.createdBy, opts.examinerR1, opts.examineeR1, opts.setR1, opts.setR2],
    );
    const matchId = matchRes.rows[0].id;
    await client.query(
      `INSERT INTO rounds (match_id, round_number, examiner_id, examinee_id, question_set_id)
       VALUES ($1, 1, $2, $3, $4)`,
      [matchId, opts.examinerR1, opts.examineeR1, opts.setR1],
    );
    await client.query('COMMIT');
    return matchId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getRoundId(matchId: string, roundNumber: 1 | 2): Promise<string | null> {
  const res = await query<{ id: string }>(
    `SELECT id FROM rounds WHERE match_id = $1 AND round_number = $2`,
    [matchId, roundNumber],
  );
  return res.rows[0]?.id ?? null;
}

/** Mark an in-progress match (and its open rounds) as abandoned. */
export async function abandonMatch(matchId: string): Promise<void> {
  await query(
    `UPDATE matches SET status = 'abandoned', ended_at = now()
     WHERE id = $1 AND status = 'active'`,
    [matchId],
  );
  await query(
    `UPDATE rounds SET status = 'abandoned', ended_at = now()
     WHERE match_id = $1 AND status = 'in_progress'`,
    [matchId],
  );
}

export async function completeMatch(matchId: string): Promise<void> {
  await query(
    `UPDATE matches SET status = 'completed', ended_at = now()
     WHERE id = $1 AND status = 'active'`,
    [matchId],
  );
}

/** Create a round row (round 2 is created at role-swap time). Idempotent. */
export async function createRound(opts: {
  matchId: string;
  roundNumber: 1 | 2;
  examinerId: string;
  examineeId: string;
  questionSetId: string;
}): Promise<string | null> {
  const res = await query<{ id: string }>(
    `INSERT INTO rounds (match_id, round_number, examiner_id, examinee_id, question_set_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (match_id, round_number) DO NOTHING
     RETURNING id`,
    [opts.matchId, opts.roundNumber, opts.examinerId, opts.examineeId, opts.questionSetId],
  );
  return res.rows[0]?.id ?? null;
}

/** Record how far the examiner got in a round (monotonic). */
export async function updateRoundProgress(roundId: string, maxPart: number): Promise<void> {
  await query(
    `UPDATE rounds SET max_part_reached = GREATEST(max_part_reached, $2) WHERE id = $1`,
    [roundId, maxPart],
  );
}

export async function markRoundScored(roundId: string): Promise<void> {
  await query(
    `UPDATE rounds SET status = 'scored', ended_at = now()
     WHERE id = $1 AND status = 'in_progress'`,
    [roundId],
  );
}

/**
 * Boot-time sweep: any match still 'active' has no in-memory exam state
 * (the server just started), so it can never finish — mark it abandoned.
 */
export async function abandonOrphanedMatches(): Promise<number> {
  const matches = await query(
    `UPDATE matches SET status = 'abandoned', ended_at = now()
     WHERE status = 'active'`,
  );
  const rounds = await query(
    `UPDATE rounds SET status = 'abandoned', ended_at = now()
     WHERE status = 'in_progress'`,
  );
  const n = (matches.rowCount ?? 0) + (rounds.rowCount ?? 0);
  if (n > 0) console.log(`[db] abandoned ${matches.rowCount ?? 0} orphaned active match(es) on boot`);
  return n;
}
