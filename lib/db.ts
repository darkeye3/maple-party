import { env } from 'cloudflare:workers';
import {
  createPartiesTable,
  createPartyMembersIndex,
  createPartyMembersTable,
  createUpcomingPartiesIndex,
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
        database.prepare(createUpcomingPartiesIndex),
        database.prepare(createPartyMembersIndex),
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
        ['combat_role', 'ALTER TABLE party_members ADD COLUMN combat_role TEXT'],
        ['terms_version_agreed', 'ALTER TABLE party_members ADD COLUMN terms_version_agreed INTEGER'],
        ['terms_agreed_at', 'ALTER TABLE party_members ADD COLUMN terms_agreed_at TEXT'],
      ] as const;
      for (const [name, sql] of memberColumnMigrations) {
        if (!memberColumnNames.has(name)) await database.prepare(sql).run();
      }
    })().catch((error: unknown) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}
