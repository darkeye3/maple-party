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
    schemaPromise = database.batch([
      database.prepare(createPartiesTable),
      database.prepare(createPartyMembersTable),
      database.prepare(createUpcomingPartiesIndex),
      database.prepare(createPartyMembersIndex),
    ]).then(() => undefined).catch((error: unknown) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}
