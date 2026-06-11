-- ============================================================
-- Copa do Mundo 2026 - Database Schema (PostgreSQL / Supabase)
-- Execute este SQL no SQL Editor do Supabase
-- ============================================================

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de grupos
CREATE TABLE IF NOT EXISTS groups_cup (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Tabela de times
CREATE TABLE IF NOT EXISTS teams (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  flag TEXT,
  group_id TEXT NOT NULL REFERENCES groups_cup(id)
);

-- Palpites da fase de grupos
CREATE TABLE IF NOT EXISTS group_predictions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups_cup(id),
  first_place_team_id BIGINT NOT NULL REFERENCES teams(id),
  second_place_team_id BIGINT NOT NULL REFERENCES teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

-- Palpites do mata-mata
CREATE TABLE IF NOT EXISTS knockout_predictions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  stage TEXT NOT NULL,
  team_id BIGINT REFERENCES teams(id),
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stage)
);

-- ============================================================
-- GRUPOS E TIMES
-- ============================================================

INSERT INTO groups_cup (id, name) VALUES
  ('A', 'Grupo A'), ('B', 'Grupo B'), ('C', 'Grupo C'),
  ('D', 'Grupo D'), ('E', 'Grupo E'), ('F', 'Grupo F'),
  ('G', 'Grupo G'), ('H', 'Grupo H'), ('I', 'Grupo I'),
  ('J', 'Grupo J'), ('K', 'Grupo K'), ('L', 'Grupo L')
ON CONFLICT (id) DO NOTHING;

INSERT INTO teams (name, flag, group_id) VALUES
  -- Grupo A
  ('México', '🇲🇽', 'A'),
  ('África do Sul', '🇿🇦', 'A'),
  ('Coreia do Sul', '🇰🇷', 'A'),
  ('República Tcheca', '🇨🇿', 'A'),
  -- Grupo B
  ('Canadá', '🇨🇦', 'B'),
  ('Bósnia e Herzegovina', '🇧🇦', 'B'),
  ('Catar', '🇶🇦', 'B'),
  ('Suíça', '🇨🇭', 'B'),
  -- Grupo C
  ('Brasil', '🇧🇷', 'C'),
  ('Marrocos', '🇲🇦', 'C'),
  ('Haiti', '🇭🇹', 'C'),
  ('Escócia', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'C'),
  -- Grupo D
  ('Estados Unidos', '🇺🇸', 'D'),
  ('Paraguai', '🇵🇾', 'D'),
  ('Austrália', '🇦🇺', 'D'),
  ('Turquia', '🇹🇷', 'D'),
  -- Grupo E
  ('Alemanha', '🇩🇪', 'E'),
  ('Curaçao', '🇨🇼', 'E'),
  ('Costa do Marfim', '🇨🇮', 'E'),
  ('Equador', '🇪🇨', 'E'),
  -- Grupo F
  ('Holanda', '🇳🇱', 'F'),
  ('Japão', '🇯🇵', 'F'),
  ('Suécia', '🇸🇪', 'F'),
  ('Tunísia', '🇹🇳', 'F'),
  -- Grupo G
  ('Bélgica', '🇧🇪', 'G'),
  ('Egito', '🇪🇬', 'G'),
  ('Irã', '🇮🇷', 'G'),
  ('Nova Zelândia', '🇳🇿', 'G'),
  -- Grupo H
  ('Espanha', '🇪🇸', 'H'),
  ('Cabo Verde', '🇨🇻', 'H'),
  ('Arábia Saudita', '🇸🇦', 'H'),
  ('Uruguai', '🇺🇾', 'H'),
  -- Grupo I
  ('França', '🇫🇷', 'I'),
  ('Senegal', '🇸🇳', 'I'),
  ('Iraque', '🇮🇶', 'I'),
  ('Noruega', '🇳🇴', 'I'),
  -- Grupo J
  ('Argentina', '🇦🇷', 'J'),
  ('Argélia', '🇩🇿', 'J'),
  ('Áustria', '🇦🇹', 'J'),
  ('Jordânia', '🇯🇴', 'J'),
  -- Grupo K
  ('Portugal', '🇵🇹', 'K'),
  ('RD Congo', '🇨🇩', 'K'),
  ('Uzbequistão', '🇺🇿', 'K'),
  ('Colômbia', '🇨🇴', 'K'),
  -- Grupo L
  ('Inglaterra', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'L'),
  ('Croácia', '🇭🇷', 'L'),
  ('Gana', '🇬🇭', 'L'),
  ('Panamá', '🇵🇦', 'L')
ON CONFLICT (id) DO NOTHING;
