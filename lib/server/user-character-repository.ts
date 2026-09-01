import type { RegisteredCharacter } from '@/lib/characters';

type CharacterRow = {
  id: string;
  nickname: string;
  hexa_stat: number;
  character_class: string;
  character_level: number;
  character_image: string | null;
  arcane_force: number;
  authentic_force: number;
  registered_at: string;
  updated_at: string;
};

export type UpsertUserCharacterRecord = {
  id: string;
  userId: string;
  nickname: string;
  hexaStat: number;
  characterClass: string;
  characterLevel: number;
  characterImage?: string | null;
  arcaneForce: number;
  authenticForce: number;
  nowIso: string;
};

function characterFromRow(row: CharacterRow): RegisteredCharacter {
  return {
    id: row.id,
    nickname: row.nickname,
    hexaStat: row.hexa_stat,
    characterClass: row.character_class,
    characterLevel: row.character_level,
    characterImage: row.character_image,
    arcaneForce: row.arcane_force,
    authenticForce: row.authentic_force,
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
  };
}

export class UserCharacterRepository {
  constructor(private readonly database: D1Database) {}

  async listByUser(userId: string) {
    const { results } = await this.database.prepare(`
      SELECT
        id, nickname, hexa_stat, character_class, character_level, character_image,
        arcane_force, authentic_force, registered_at, updated_at
      FROM user_characters
      WHERE user_id = ?
      ORDER BY updated_at DESC, registered_at DESC
    `).bind(userId).all<CharacterRow>();
    return results.map(characterFromRow);
  }

  async upsert(record: UpsertUserCharacterRecord) {
    await this.database.prepare(`
      INSERT INTO user_characters (
        id, user_id, nickname, hexa_stat, character_class, character_level, character_image,
        arcane_force, authentic_force, registered_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, nickname) DO UPDATE SET
        hexa_stat = excluded.hexa_stat,
        character_class = excluded.character_class,
        character_level = excluded.character_level,
        character_image = excluded.character_image,
        arcane_force = excluded.arcane_force,
        authentic_force = excluded.authentic_force,
        updated_at = excluded.updated_at
    `).bind(
      record.id,
      record.userId,
      record.nickname,
      record.hexaStat,
      record.characterClass,
      record.characterLevel,
      record.characterImage ?? null,
      record.arcaneForce,
      record.authenticForce,
      record.nowIso,
      record.nowIso,
    ).run();
    return this.findByNickname(record.userId, record.nickname);
  }

  async findByNickname(userId: string, nickname: string) {
    const row = await this.database.prepare(`
      SELECT
        id, nickname, hexa_stat, character_class, character_level, character_image,
        arcane_force, authentic_force, registered_at, updated_at
      FROM user_characters
      WHERE user_id = ?
        AND nickname = ?
    `).bind(userId, nickname).first<CharacterRow>();
    return row ? characterFromRow(row) : undefined;
  }

  async deleteById(userId: string, characterId: string) {
    const result = await this.database.prepare(`
      DELETE FROM user_characters
      WHERE user_id = ?
        AND id = ?
    `).bind(userId, characterId).run();
    return Boolean(result.meta.changes);
  }
}
