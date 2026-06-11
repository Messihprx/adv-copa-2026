-- Add third_place_team_id column to group_predictions
ALTER TABLE group_predictions ADD COLUMN IF NOT EXISTS third_place_team_id INTEGER REFERENCES teams(id);

-- Create third_place_advancing table
CREATE TABLE IF NOT EXISTS third_place_advancing (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  team_id INTEGER NOT NULL REFERENCES teams(id),
  UNIQUE(user_id, team_id)
);
