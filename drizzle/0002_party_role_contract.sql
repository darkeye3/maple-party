ALTER TABLE parties ADD COLUMN format_version TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE parties ADD COLUMN required_party_rate REAL;
ALTER TABLE parties ADD COLUMN main_capacity INTEGER;
ALTER TABLE parties ADD COLUMN main_minimum_rate REAL;
ALTER TABLE parties ADD COLUMN secondary_capacity INTEGER;
ALTER TABLE parties ADD COLUMN secondary_minimum_rate REAL;
ALTER TABLE parties ADD COLUMN reward_preset TEXT;
ALTER TABLE parties ADD COLUMN secondary_crystal_share REAL;
ALTER TABLE parties ADD COLUMN terms_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE parties ADD COLUMN terms_locked_at TEXT;

ALTER TABLE party_members ADD COLUMN combat_role TEXT;
ALTER TABLE party_members ADD COLUMN terms_version_agreed INTEGER;
ALTER TABLE party_members ADD COLUMN terms_agreed_at TEXT;

PRAGMA optimize;
