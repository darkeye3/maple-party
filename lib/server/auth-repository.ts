import type { AuthUser } from '@/lib/auth';

type UserRow = {
  id: string;
  login_name: string;
  display_name: string;
  password_salt: string;
  password_hash: string;
  created_at: string;
};

type SessionUserRow = {
  session_id: string;
  id: string;
  login_name: string;
  display_name: string;
  created_at: string;
  expires_at: string;
};

export type StoredUser = AuthUser & {
  passwordSalt: string;
  passwordHash: string;
};

export type StoredSessionUser = AuthUser & {
  sessionId: string;
  expiresAt: string;
};

export type CreateUserRecord = {
  id: string;
  loginName: string;
  displayName: string;
  passwordSalt: string;
  passwordHash: string;
  nowIso: string;
};

function userFromRow(row: UserRow): StoredUser {
  return {
    id: row.id,
    loginName: row.login_name,
    displayName: row.display_name,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function sessionUserFromRow(row: SessionUserRow): StoredSessionUser {
  return {
    id: row.id,
    loginName: row.login_name,
    displayName: row.display_name,
    createdAt: row.created_at,
    sessionId: row.session_id,
    expiresAt: row.expires_at,
  };
}

export class AuthRepository {
  constructor(private readonly database: D1Database) {}

  async findUserByLoginName(loginName: string) {
    const row = await this.database.prepare(`
      SELECT id, login_name, display_name, password_salt, password_hash, created_at
      FROM users
      WHERE login_name = ?
    `).bind(loginName).first<UserRow>();
    return row ? userFromRow(row) : undefined;
  }

  async createUser(record: CreateUserRecord) {
    await this.database.prepare(`
      INSERT INTO users (
        id, login_name, display_name, password_salt, password_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      record.id,
      record.loginName,
      record.displayName,
      record.passwordSalt,
      record.passwordHash,
      record.nowIso,
      record.nowIso,
    ).run();
  }

  async createSession(sessionId: string, userId: string, expiresAt: string, nowIso: string) {
    await this.database.prepare(`
      INSERT INTO user_sessions (id, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(sessionId, userId, expiresAt, nowIso).run();
  }

  async findSessionUser(sessionId: string, nowIso = new Date().toISOString()) {
    const row = await this.database.prepare(`
      SELECT
        s.id AS session_id,
        s.expires_at AS expires_at,
        u.id AS id,
        u.login_name AS login_name,
        u.display_name AS display_name,
        u.created_at AS created_at
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
        AND s.expires_at > ?
    `).bind(sessionId, nowIso).first<SessionUserRow>();
    return row ? sessionUserFromRow(row) : undefined;
  }

  async deleteSession(sessionId: string) {
    await this.database.prepare(`
      DELETE FROM user_sessions
      WHERE id = ?
    `).bind(sessionId).run();
  }

  async deleteExpiredSessions(nowIso = new Date().toISOString()) {
    await this.database.prepare(`
      DELETE FROM user_sessions
      WHERE expires_at <= ?
    `).bind(nowIso).run();
  }
}
