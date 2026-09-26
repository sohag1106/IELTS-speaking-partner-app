-- IELTS Speaking Partner schema (idempotent)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nickname        TEXT NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 24),
  auth_token_hash TEXT NOT NULL UNIQUE,
  password_hash   TEXT,                      -- NULL in MVP (future login upgrade)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_sets (
  id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  ord   INT  NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_set_id BIGINT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  part            SMALLINT NOT NULL CHECK (part IN (1, 2, 3)),
  ordinal         INT NOT NULL,
  prompt          TEXT NOT NULL,
  lead_in         TEXT,
  bullets         TEXT[],
  UNIQUE (question_set_id, part, ordinal)
);

CREATE TABLE IF NOT EXISTS matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE,               -- NULL for random-queue matches
  created_by      BIGINT REFERENCES users(id),
  examiner_r1     BIGINT NOT NULL REFERENCES users(id),
  examinee_r1     BIGINT NOT NULL REFERENCES users(id),
  question_set_r1 BIGINT NOT NULL REFERENCES question_sets(id),
  question_set_r2 BIGINT NOT NULL REFERENCES question_sets(id),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS rounds (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id         UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round_number     SMALLINT NOT NULL CHECK (round_number IN (1, 2)),
  examiner_id      BIGINT NOT NULL REFERENCES users(id),
  examinee_id      BIGINT NOT NULL REFERENCES users(id),
  question_set_id  BIGINT NOT NULL REFERENCES question_sets(id),
  status           TEXT NOT NULL DEFAULT 'in_progress'
                   CHECK (status IN ('in_progress', 'scored', 'abandoned')),
  max_part_reached SMALLINT NOT NULL DEFAULT 0 CHECK (max_part_reached BETWEEN 0 AND 3),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  UNIQUE (match_id, round_number)
);

CREATE TABLE IF NOT EXISTS scores (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  round_id    BIGINT NOT NULL UNIQUE REFERENCES rounds(id) ON DELETE CASCADE,
  match_id    UUID   NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  examinee_id BIGINT NOT NULL REFERENCES users(id),
  examiner_id BIGINT NOT NULL REFERENCES users(id),
  band        NUMERIC(2,1) NOT NULL
              CHECK (band >= 0 AND band <= 9 AND band * 2 = floor(band * 2)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scores_examinee_idx ON scores (examinee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scores_examiner_idx  ON scores (examiner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS matches_code_idx     ON matches (code) WHERE code IS NOT NULL;
