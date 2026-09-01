import { env } from 'cloudflare:workers';
import {
  createPartyMembersUserIndex,
  createPartiesTable,
  createPartyShareCodeIndex,
  createPartyMembersIndex,
  createPartyMembersTable,
  createUpcomingPartiesIndex,
  createUserSessionsExpiryIndex,
  createUserSessionsTable,
  createUserSessionsUserIndex,
  createUsersTable,
} from '@/db/schema';

type DatabaseEnvironment = Cloudflare.Env & { DB: D1Database };

let schemaPromise: Promise<void> | undefined;

export function partyDatabase() {
  const database = (env as DatabaseEnvironment).DB;
  if (!database) throw new Error('파티 데이터베이스가 연결되지 않았습니다.');
  return database;
}

export async function ensurePartySchema() {
  if (!schemaPromise) {
    const database = partyDatabase();
    schemaPromise = (async () => {
      await database.batch([
        database.prepare(createPartiesTable),
        database.prepare(createPartyMembersTable),
        database.prepare(createUsersTable),
        database.prepare(createUserSessionsTable),
        database.prepare(createUpcomingPartiesIndex),
        database.prepare(createPartyShareCodeIndex),
        database.prepare(createPartyMembersIndex),
        database.prepare(createPartyMembersUserIndex),
        database.prepare(createUserSessionsUserIndex),
        database.prepare(createUserSessionsExpiryIndex),
      ]);
      const { results } = await database.prepare('PRAGMA table_info(party_members)').all<{ name: string }>();
      if (!results.some((column) => column.name === 'character_image')) {
        try {
          await database.prepare('ALTER TABLE party_members ADD COLUMN character_image TEXT').run();
        } catch (error) {
          if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) throw error;
        }
      }
      const { results: partyColumns } = await database.prepare('PRAGMA table_info(parties)').all<{ name: string }>();
      const partyColumnNames = new Set(partyColumns.map((column) => column.name));
      const partyColumnMigrations = [
        ['share_code', 'ALTER TABLE parties ADD COLUMN share_code TEXT'],
        ['leader_user_id', 'ALTER TABLE parties ADD COLUMN leader_user_id TEXT'],
        ['format_version', "ALTER TABLE parties ADD COLUMN format_version TEXT NOT NULL DEFAULT 'legacy'"],
        ['required_party_rate', 'ALTER TABLE parties ADD COLUMN required_party_rate REAL'],
        ['main_capacity', 'ALTER TABLE parties ADD COLUMN main_capacity INTEGER'],
        ['main_minimum_rate', 'ALTER TABLE parties ADD COLUMN main_minimum_rate REAL'],
        ['secondary_capacity', 'ALTER TABLE parties ADD COLUMN secondary_capacity INTEGER'],
        ['secondary_minimum_rate', 'ALTER TABLE parties ADD COLUMN secondary_minimum_rate REAL'],
        ['reward_preset', 'ALTER TABLE parties ADD COLUMN reward_preset TEXT'],
        ['secondary_crystal_share', 'ALTER TABLE parties ADD COLUMN secondary_crystal_share REAL'],
        ['terms_version', 'ALTER TABLE parties ADD COLUMN terms_version INTEGER NOT NULL DEFAULT 1'],
        ['terms_locked_at', 'ALTER TABLE parties ADD COLUMN terms_locked_at TEXT'],
      ] as const;
      for (const [name, sql] of partyColumnMigrations) {
        if (!partyColumnNames.has(name)) await database.prepare(sql).run();
      }
      const memberColumnNames = new Set(results.map((column) => column.name));
      const memberColumnMigrations = [
        ['user_id', 'ALTER TABLE party_members ADD COLUMN user_id TEXT'],
        ['combat_role', 'ALTER TABLE party_members ADD COLUMN combat_role TEXT'],
        ['terms_version_agreed', 'ALTER TABLE party_members ADD COLUMN terms_version_agreed INTEGER'],
        ['terms_agreed_at', 'ALTER TABLE party_members ADD COLUMN terms_agreed_at TEXT'],
      ] as const;
      for (const [name, sql] of memberColumnMigrations) {
        if (!memberColumnNames.has(name)) await database.prepare(sql).run();
      }
      await database.batch([
        database.prepare(createPartyShareCodeIndex),
        database.prepare(createPartyMembersUserIndex),
        database.prepare(createUserSessionsUserIndex),
        database.prepare(createUserSessionsExpiryIndex),
      ]);
      const { results: partiesMissingShareCode } = await database.prepare(`
        SELECT id
        FROM parties
        WHERE share_code IS NULL OR share_code = ''
      `).all<{ id: string }>();
      for (const party of partiesMissingShareCode) {
        await database.prepare(`
          UPDATE parties
          SET share_code = ?
          WHERE id = ?
            AND (share_code IS NULL OR share_code = '')
        `).bind(createShortCode(), party.id).run();
      }
      await database.prepare('PRAGMA optimize').run();
    })().catch((error: unknown) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

function createShortCode() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}
