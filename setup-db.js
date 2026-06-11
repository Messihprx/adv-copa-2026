const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const sql = `
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups_cup (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  flag TEXT,
  group_id TEXT NOT NULL REFERENCES groups_cup(id)
);

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

INSERT INTO groups_cup (id, name) VALUES
  ('A', 'Grupo A'), ('B', 'Grupo B'), ('C', 'Grupo C'),
  ('D', 'Grupo D'), ('E', 'Grupo E'), ('F', 'Grupo F'),
  ('G', 'Grupo G'), ('H', 'Grupo H'), ('I', 'Grupo I'),
  ('J', 'Grupo J'), ('K', 'Grupo K'), ('L', 'Grupo L')
ON CONFLICT (id) DO NOTHING;

INSERT INTO teams (name, flag, group_id) VALUES
  ('M\u00e9xico', '\ud83c\uddf2\ud83c\uddfd', 'A'),
  ('\u00c1frica do Sul', '\ud83c\uddff\ud83c\udde6', 'A'),
  ('Coreia do Sul', '\ud83c\uddf0\ud83c\uddf7', 'A'),
  ('Rep\u00fablica Tcheca', '\ud83c\udde8\ud83c\uddff', 'A'),
  ('Canad\u00e1', '\ud83c\udde8\ud83c\udde6', 'B'),
  ('B\u00f3snia e Herzegovina', '\ud83c\udde7\ud83c\udde6', 'B'),
  ('Catar', '\ud83c\uddf6\ud83c\udde6', 'B'),
  ('Su\u00ed\u00e7a', '\ud83c\udde8\ud83c\udded', 'B'),
  ('Brasil', '\ud83c\udde7\ud83c\uddf7', 'C'),
  ('Marrocos', '\ud83c\uddf2\ud83c\udde6', 'C'),
  ('Haiti', '\ud83c\udded\ud83c\uddf9', 'C'),
  ('Esc\u00f3cia', '\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc73\udb40\udc63\udb40\udc74\udb40\udc7f', 'C'),
  ('Estados Unidos', '\ud83c\uddfa\ud83c\uddf8', 'D'),
  ('Paraguai', '\ud83c\uddf5\ud83c\uddfe', 'D'),
  ('Austr\u00e1lia', '\ud83c\udde6\ud83c\uddfa', 'D'),
  ('Turquia', '\ud83c\uddf9\ud83c\uddf7', 'D'),
  ('Alemanha', '\ud83c\udde9\ud83c\uddea', 'E'),
  ('Cura\u00e7ao', '\ud83c\udde8\ud83c\uddfc', 'E'),
  ('Costa do Marfim', '\ud83c\udde8\ud83c\uddee', 'E'),
  ('Equador', '\ud83c\uddea\ud83c\udde8', 'E'),
  ('Holanda', '\ud83c\uddf3\ud83c\uddf1', 'F'),
  ('Jap\u00e3o', '\ud83c\uddef\ud83c\uddf5', 'F'),
  ('Su\u00e9cia', '\ud83c\uddf8\ud83c\uddea', 'F'),
  ('Tun\u00edsia', '\ud83c\uddf9\ud83c\uddf3', 'F'),
  ('B\u00e9lgica', '\ud83c\udde7\ud83c\uddea', 'G'),
  ('Egito', '\ud83c\uddea\ud83c\uddec', 'G'),
  ('Ir\u00e3', '\ud83c\uddee\ud83c\uddf7', 'G'),
  ('Nova Zel\u00e2ndia', '\ud83c\uddf3\ud83c\uddff', 'G'),
  ('Espanha', '\ud83c\uddea\ud83c\uddf8', 'H'),
  ('Cabo Verde', '\ud83c\udde8\ud83c\uddfb', 'H'),
  ('Ar\u00e1bia Saudita', '\ud83c\uddf8\ud83c\udde6', 'H'),
  ('Uruguai', '\ud83c\uddfa\ud83c\uddfe', 'H'),
  ('Fran\u00e7a', '\ud83c\uddeb\ud83c\uddf7', 'I'),
  ('Senegal', '\ud83c\uddf8\ud83c\uddf3', 'I'),
  ('Iraque', '\ud83c\uddee\ud83c\uddf6', 'I'),
  ('Noruega', '\ud83c\uddf3\ud83c\uddf4', 'I'),
  ('Argentina', '\ud83c\udde6\ud83c\uddf7', 'J'),
  ('Arg\u00e9lia', '\ud83c\udde9\ud83c\uddff', 'J'),
  ('\u00c1ustria', '\ud83c\udde6\ud83c\uddf9', 'J'),
  ('Jord\u00e2nia', '\ud83c\uddef\ud83c\uddf4', 'J'),
  ('Portugal', '\ud83c\uddf5\ud83c\uddf9', 'K'),
  ('RD Congo', '\ud83c\udde8\ud83c\udde9', 'K'),
  ('Uzbequist\u00e3o', '\ud83c\uddfa\ud83c\uddff', 'K'),
  ('Col\u00f4mbia', '\ud83c\udde8\ud83c\uddf4', 'K'),
  ('Inglaterra', '\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc65\udb40\udc6e\udb40\udc67\udb40\udc7f', 'L'),
  ('Cro\u00e1cia', '\ud83c\udded\ud83c\uddf7', 'L'),
  ('Gana', '\ud83c\uddec\ud83c\udded', 'L'),
  ('Panam\u00e1', '\ud83c\uddf5\ud83c\udde6', 'L')
ON CONFLICT (id) DO NOTHING;
`;

async function setup() {
  const { error } = await supabase.rpc('exec_sql', { sql_text: sql });
  if (error) {
    console.log('RPC exec_sql not available, trying direct SQL via REST...');
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ query: sql })
    });
    if (!res.ok) {
      console.log('Direct REST also failed. You need to run the SQL manually.');
      console.log('Go to: https://supabase.com/dashboard/project/xsjiklyxfqhhuzistbpj/sql/new');
      console.log('And paste the content from database.sql file.');
      console.log('The server will still work for login/signup since users table creates automatically.');
    } else {
      console.log('Database setup complete!');
    }
  } else {
    console.log('Database setup complete!');
  }
}

setup().catch(console.error);
