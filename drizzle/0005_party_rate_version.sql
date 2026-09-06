ALTER TABLE party_members ADD COLUMN verified_rate_version INTEGER NOT NULL DEFAULT 1;

PRAGMA optimize;
