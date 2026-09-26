import { query } from '../pool.js';

/**
 * Insert a score for a round. The UNIQUE constraint on round_id makes this
 * idempotent: returns false if a score already exists for the round.
 */
export async function insertScore(opts: {
  roundId: string;
  matchId: string;
  examineeId: string;
  examinerId: string;
  band: number;
}): Promise<boolean> {
  const res = await query(
    `INSERT INTO scores (round_id, match_id, examinee_id, examiner_id, band)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (round_id) DO NOTHING`,
    [opts.roundId, opts.matchId, opts.examineeId, opts.examinerId, opts.band],
  );
  return (res.rowCount ?? 0) > 0;
}
