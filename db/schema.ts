export const createPartiesTable = `
  CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    boss_id TEXT NOT NULL,
    boss_name TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity BETWEEN 2 AND 6),
    minimum_rate REAL NOT NULL CHECK (minimum_rate BETWEEN 1 AND 1000),
    departure_at TEXT NOT NULL,
    leader_nickname TEXT NOT NULL,
    leader_hexa INTEGER NOT NULL,
    leader_rate REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'cancelled')),
    created_at TEXT NOT NULL
  )
`;

export const createPartyMembersTable = `
  CREATE TABLE IF NOT EXISTS party_members (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    character_class TEXT NOT NULL,
    character_level INTEGER NOT NULL,
    character_image TEXT,
    hexa_stat INTEGER NOT NULL,
    verified_rate REAL NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('leader', 'member')),
    joined_at TEXT NOT NULL,
    UNIQUE (party_id, nickname)
  )
`;

export const createUpcomingPartiesIndex = `
  CREATE INDEX IF NOT EXISTS idx_parties_status_departure
  ON parties(status, departure_at)
`;

export const createPartyMembersIndex = `
  CREATE INDEX IF NOT EXISTS idx_party_members_party_joined
  ON party_members(party_id, joined_at)
`;
