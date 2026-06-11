-- Fix third_place_advancing user_id type (was UUID, must be BIGINT)
ALTER TABLE third_place_advancing ALTER COLUMN user_id TYPE BIGINT USING user_id::BIGINT;

-- Fix match_predictions if missing
CREATE TABLE IF NOT EXISTS match_predictions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  match_id INTEGER NOT NULL,
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- Scoring history for full audit trail
CREATE TABLE IF NOT EXISTS scoring_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  subreference_id TEXT,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scoring_history_user ON scoring_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scoring_history_ref ON scoring_history(reference_id);
