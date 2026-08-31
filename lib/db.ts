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
    })().catch((error: unknown) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}
