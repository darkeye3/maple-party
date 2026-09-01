CREATE TABLE IF NOT EXISTS user_characters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  hexa_stat INTEGER NOT NULL,
  character_class TEXT NOT NULL,
  character_level INTEGER NOT NULL,
  character_image TEXT,
  arcane_force INTEGER NOT NULL DEFAULT 0,
  authentic_force INTEGER NOT NULL DEFAULT 0,
  registered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, nickname)
);

CREATE INDEX IF NOT EXISTS idx_user_characters_user
ON user_characters(user_id, updated_at);

PRAGMA optimize;
