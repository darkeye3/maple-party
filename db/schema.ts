export const createPartiesTable = `
  CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    share_code TEXT,
    boss_id TEXT NOT NULL,
    boss_name TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity BETWEEN 2 AND 6),
    minimum_rate REAL NOT NULL CHECK (minimum_rate BETWEEN 1 AND 1000),
    departure_at TEXT NOT NULL,
    leader_user_id TEXT,
    leader_nickname TEXT NOT NULL,
    leader_hexa INTEGER NOT NULL,
    leader_rate REAL NOT NULL,
    format_version TEXT NOT NULL DEFAULT 'legacy',
    required_party_rate REAL,
    main_capacity INTEGER,
    main_minimum_rate REAL,
    secondary_capacity INTEGER,
    secondary_minimum_rate REAL,
    reward_preset TEXT,
    secondary_crystal_share REAL,
    terms_version INTEGER NOT NULL DEFAULT 1,
    terms_locked_at TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'cancelled')),
    created_at TEXT NOT NULL
  )
`;

export const createPartyMembersTable = `
  CREATE TABLE IF NOT EXISTS party_members (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    user_id TEXT,
    nickname TEXT NOT NULL,
    character_class TEXT NOT NULL,
    character_level INTEGER NOT NULL,
    character_image TEXT,
    hexa_stat INTEGER NOT NULL,
    verified_rate REAL NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('leader', 'member')),
    combat_role TEXT,
    terms_version_agreed INTEGER,
    terms_agreed_at TEXT,
    joined_at TEXT NOT NULL,
    UNIQUE (party_id, nickname)
  )
`;

export const createUsersTable = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    login_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

export const createUserSessionsTable = `
  CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`;

export const createUserCharactersTable = `
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
  )
`;

export const createUpcomingPartiesIndex = `
  CREATE INDEX IF NOT EXISTS idx_parties_status_departure
  ON parties(status, departure_at)
`;

export const createPartyShareCodeIndex = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_share_code
  ON parties(share_code)
  WHERE share_code IS NOT NULL
`;

export const createPartyMembersIndex = `
  CREATE INDEX IF NOT EXISTS idx_party_members_party_joined
  ON party_members(party_id, joined_at)
`;

export const createPartyMembersUserIndex = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_party_members_party_user
  ON party_members(party_id, user_id)
  WHERE user_id IS NOT NULL
`;

export const createUserSessionsUserIndex = `
  CREATE INDEX IF NOT EXISTS idx_user_sessions_user
  ON user_sessions(user_id, expires_at)
`;

export const createUserSessionsExpiryIndex = `
  CREATE INDEX IF NOT EXISTS idx_user_sessions_expires
  ON user_sessions(expires_at)
`;

export const createUserCharactersUserIndex = `
  CREATE INDEX IF NOT EXISTS idx_user_characters_user
  ON user_characters(user_id, updated_at)
`;
