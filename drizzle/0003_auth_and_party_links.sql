ALTER TABLE parties ADD COLUMN share_code TEXT;
ALTER TABLE parties ADD COLUMN leader_user_id TEXT;
ALTER TABLE party_members ADD COLUMN user_id TEXT;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  login_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_share_code
ON parties(share_code)
WHERE share_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_party_members_party_user
ON party_members(party_id, user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
ON user_sessions(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires
ON user_sessions(expires_at);

PRAGMA optimize;
