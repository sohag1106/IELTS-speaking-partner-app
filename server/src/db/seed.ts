import { pool } from './pool.js';
import { QUESTION_SETS } from './questions.js';

/**
 * Dev-oriented reseed: clears questions/question_sets and inserts the
 * authored bank. Runs in one transaction with hard count assertions.
 */
async function main() {
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  for (const set of QUESTION_SETS) {
    p1 += set.part1.length;
    p2 += set.part2.length;
    p3 += set.part3.length;
  }
  const total = p1 + p2 + p3;
  if (p1 !== 30 || p2 !== 30 || p3 !== 40 || total !== 100) {
    throw new Error(
      `Question bank is malformed: expected P1=30 P2=30 P3=40 total=100, got P1=${p1} P2=${p2} P3=${p3} total=${total}`,
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM questions');
    await client.query('DELETE FROM question_sets');

    let ord = 0;
    for (const set of QUESTION_SETS) {
      ord += 1;
      const setRes = await client.query<{ id: string }>(
        `INSERT INTO question_sets (slug, title, ord) VALUES ($1, $2, $3) RETURNING id`,
        [set.slug, set.title, ord],
      );
      const setId = setRes.rows[0].id;

      for (let i = 0; i < set.part1.length; i++) {
        await client.query(
          `INSERT INTO questions (question_set_id, part, ordinal, prompt) VALUES ($1, 1, $2, $3)`,
          [setId, i + 1, set.part1[i].prompt],
        );
      }
      for (let i = 0; i < set.part2.length; i++) {
        const card = set.part2[i];
        await client.query(
          `INSERT INTO questions (question_set_id, part, ordinal, prompt, lead_in, bullets)
           VALUES ($1, 2, $2, $3, $4, $5)`,
          [setId, i + 1, card.prompt, card.leadIn, card.bullets],
        );
      }
      for (let i = 0; i < set.part3.length; i++) {
        await client.query(
          `INSERT INTO questions (question_set_id, part, ordinal, prompt) VALUES ($1, 3, $2, $3)`,
          [setId, i + 1, set.part3[i].prompt],
        );
      }
    }

    const check = await client.query<{ p1: string; p2: string; p3: string; total: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE part = 1)::text AS p1,
         COUNT(*) FILTER (WHERE part = 2)::text AS p2,
         COUNT(*) FILTER (WHERE part = 3)::text AS p3,
         COUNT(*)::text AS total
       FROM questions`,
    );
    const { p1: dbP1, p2: dbP2, p3: dbP3, total: dbTotal } = check.rows[0];
    if (dbP1 !== '30' || dbP2 !== '30' || dbP3 !== '40' || dbTotal !== '100') {
      throw new Error(`DB counts wrong after seed: P1=${dbP1} P2=${dbP2} P3=${dbP3} total=${dbTotal}`);
    }

    await client.query('COMMIT');
    console.log(`[seed] ${QUESTION_SETS.length} sets, ${dbTotal} questions (P1=${dbP1}, P2=${dbP2}, P3=${dbP3}).`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
