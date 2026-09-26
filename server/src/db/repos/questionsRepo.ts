import { query } from '../pool.js';

export interface QuestionSetRow {
  id: string;
  slug: string;
  title: string;
}

export interface QuestionRow {
  id: string;
  question_set_id: string;
  part: 1 | 2 | 3;
  ordinal: number;
  prompt: string;
  lead_in: string | null;
  bullets: string[] | null;
}

/** Pick N distinct random set ids (used for round 1 + round 2 of a match). */
export async function randomDistinctSetIds(count: number): Promise<string[]> {
  const res = await query<{ id: string }>(
    `SELECT id FROM question_sets ORDER BY random() LIMIT $1`,
    [count],
  );
  return res.rows.map((r) => r.id);
}

export async function getSetPayload(setId: string) {
  const setRes = await query<QuestionSetRow>(
    `SELECT id, slug, title FROM question_sets WHERE id = $1`,
    [setId],
  );
  const set = setRes.rows[0];
  if (!set) throw new Error(`question set ${setId} not found`);

  const qRes = await query<QuestionRow>(
    `SELECT id, question_set_id, part, ordinal, prompt, lead_in, bullets
     FROM questions WHERE question_set_id = $1 ORDER BY part, ordinal`,
    [setId],
  );

  return {
    id: set.id,
    slug: set.slug,
    title: set.title,
    part1: qRes.rows.filter((q) => q.part === 1).map((q) => ({ prompt: q.prompt })),
    part2: qRes.rows
      .filter((q) => q.part === 2)
      .map((q) => ({
        ordinal: q.ordinal,
        prompt: q.prompt,
        leadIn: q.lead_in ?? '',
        bullets: q.bullets ?? [],
      })),
    part3: qRes.rows.filter((q) => q.part === 3).map((q) => ({ prompt: q.prompt })),
  };
}

export type QuestionSetPayload = Awaited<ReturnType<typeof getSetPayload>>;
