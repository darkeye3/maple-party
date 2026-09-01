import type { CombatRole, PartyMember, PartyPost, RewardPreset } from '@/lib/parties';

type PartyRow = {
  id: string;
  share_code: string | null;
  boss_id: string;
  boss_name: string;
  difficulty: string;
  capacity: number;
  minimum_rate: number;
  departure_at: string;
  leader_user_id: string | null;
  leader_nickname: string;
  leader_hexa: number;
  leader_rate: number;
  format_version: 'legacy' | 'role_contract_v2' | null;
  required_party_rate: number | null;
  main_capacity: number | null;
  main_minimum_rate: number | null;
  secondary_capacity: number | null;
  secondary_minimum_rate: number | null;
  reward_preset: RewardPreset | null;
  secondary_crystal_share: number | null;
  terms_version: number | null;
  terms_locked_at: string | null;
  status: 'open' | 'full' | 'cancelled';
  created_at: string;
  member_count: number;
  total_rate: number;
};

type MemberRow = {
  id: string;
  party_id: string;
  user_id: string | null;
  nickname: string;
  character_class: string;
  character_level: number;
  character_image: string | null;
  hexa_stat: number;
  verified_rate: number;
  role: 'leader' | 'member';
  combat_role: CombatRole | null;
  terms_version_agreed: number | null;
  terms_agreed_at: string | null;
  joined_at: string;
};

export type CreatePartyRecord = {
  bossId: string;
  bossName: string;
  capacity: number;
  createdAt: string;
  departureAt: string;
  difficulty: string;
  formatVersion: PartyPost['formatVersion'];
  leaderCharacterClass: string;
  leaderCharacterImage?: string;
  leaderCharacterLevel: number;
  leaderCombatRole?: CombatRole;
  leaderHexa: number;
  leaderNickname: string;
  leaderRate: number;
  leaderUserId: string;
  mainCapacity?: number;
  mainMinimumRate?: number;
  memberId: string;
  minimumRate: number;
  partyId: string;
  requiredPartyRate?: number;
  rewardPreset?: RewardPreset;
  secondaryCapacity?: number;
  secondaryCrystalShare?: number;
  secondaryMinimumRate?: number;
  shareCode: string;
};

export type AddPartyMemberRecord = {
  characterClass: string;
  characterImage?: string;
  characterLevel: number;
  combatRole?: CombatRole;
  hexaStat: number;
  joinedAt: string;
  nickname: string;
  partyId: string;
  termsVersion?: number;
  userId: string;
  verifiedRate: number;
};

function memberFromRow(row: MemberRow, currentUserId?: string | null): PartyMember {
  return {
    id: row.id,
    nickname: row.nickname,
    characterClass: row.character_class,
    characterLevel: row.character_level,
    characterImage: row.character_image ?? undefined,
    hexaStat: row.hexa_stat,
    verifiedRate: row.verified_rate,
    role: row.role,
    combatRole: row.combat_role ?? undefined,
    isCurrentUser: Boolean(currentUserId && row.user_id === currentUserId),
    termsVersionAgreed: row.terms_version_agreed ?? undefined,
    termsAgreedAt: row.terms_agreed_at ?? undefined,
    joinedAt: row.joined_at,
  };
}

function partyFromRow(row: PartyRow, members: PartyMember[]): PartyPost {
  return {
    id: row.id,
    shareCode: row.share_code ?? row.id,
    bossId: row.boss_id,
    bossName: row.boss_name,
    difficulty: row.difficulty,
    capacity: row.capacity,
    minimumRate: row.minimum_rate,
    departureAt: row.departure_at,
    leaderNickname: row.leader_nickname,
    leaderHexa: row.leader_hexa,
    leaderRate: row.leader_rate,
    formatVersion: row.format_version === 'role_contract_v2' ? 'role_contract_v2' : 'legacy',
    requiredPartyRate: row.required_party_rate ?? undefined,
    mainCapacity: row.main_capacity ?? undefined,
    mainMinimumRate: row.main_minimum_rate ?? undefined,
    secondaryCapacity: row.secondary_capacity ?? undefined,
    secondaryMinimumRate: row.secondary_minimum_rate ?? undefined,
    rewardPreset: row.reward_preset ?? undefined,
    secondaryCrystalShare: row.secondary_crystal_share ?? undefined,
    termsVersion: row.terms_version ?? 1,
    termsLockedAt: row.terms_locked_at ?? undefined,
    status: row.member_count >= row.capacity ? 'full' : row.status,
    createdAt: row.created_at,
    totalRate: row.total_rate,
    members,
  };
}

export class PartyRepository {
  constructor(
    private readonly database: D1Database,
    private readonly currentUserId?: string | null,
  ) {}

  async listActiveParties(nowIso = new Date().toISOString()) {
    return this.loadParties({ nowIso });
  }

  async findPartyById(partyId: string) {
    const parties = await this.loadParties({ partyId });
    return parties[0];
  }

  async syncActiveMemberImage(nickname: string, characterImage: string, nowIso = new Date().toISOString()) {
    await this.database.prepare(`
      UPDATE party_members
      SET character_image = ?
      WHERE nickname = ?
        AND party_id IN (
          SELECT id FROM parties
          WHERE departure_at > ? AND status != 'cancelled'
        )
    `).bind(characterImage, nickname, nowIso).run();
  }

  async createPartyWithLeader(record: CreatePartyRecord) {
    await this.database.batch([
      this.database.prepare(`
        INSERT INTO parties (
          id, share_code, boss_id, boss_name, difficulty, capacity, minimum_rate, departure_at,
          leader_user_id, leader_nickname, leader_hexa, leader_rate, format_version, required_party_rate,
          main_capacity, main_minimum_rate, secondary_capacity, secondary_minimum_rate,
          reward_preset, secondary_crystal_share, terms_version, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'open', ?)
      `).bind(
        record.partyId,
        record.shareCode,
        record.bossId,
        record.bossName,
        record.difficulty,
        record.capacity,
        record.minimumRate,
        record.departureAt,
        record.leaderUserId,
        record.leaderNickname,
        record.leaderHexa,
        record.leaderRate,
        record.formatVersion,
        record.requiredPartyRate ?? null,
        record.mainCapacity ?? null,
        record.mainMinimumRate ?? null,
        record.secondaryCapacity ?? null,
        record.secondaryMinimumRate ?? null,
        record.rewardPreset ?? null,
        record.secondaryCrystalShare ?? null,
        record.createdAt,
      ),
      this.database.prepare(`
        INSERT INTO party_members (
          id, party_id, user_id, nickname, character_class, character_level,
          character_image, hexa_stat, verified_rate, role, combat_role,
          terms_version_agreed, terms_agreed_at, joined_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'leader', ?, ?, ?, ?)
      `).bind(
        record.memberId,
        record.partyId,
        record.leaderUserId,
        record.leaderNickname,
        record.leaderCharacterClass,
        record.leaderCharacterLevel,
        record.leaderCharacterImage ?? null,
        record.leaderHexa,
        record.leaderRate,
        record.leaderCombatRole ?? null,
        record.formatVersion === 'role_contract_v2' ? 1 : null,
        record.formatVersion === 'role_contract_v2' ? record.createdAt : null,
        record.createdAt,
      ),
    ]);
  }

  async addMemberIfEligible(record: AddPartyMemberRecord, roleContract: boolean) {
    const result = roleContract
      ? await this.insertRoleContractMember(record)
      : await this.insertLegacyMember(record);
    return Boolean(result.meta.changes);
  }

  async lockTermsIfUnset(partyId: string, joinedAt: string) {
    await this.database.prepare(`
      UPDATE parties
      SET terms_locked_at = COALESCE(terms_locked_at, ?)
      WHERE id = ?
    `).bind(joinedAt, partyId).run();
  }

  async markFullIfCapacityReached(partyId: string) {
    await this.database.prepare(`
      UPDATE parties
      SET status = 'full'
      WHERE id = ?
        AND (SELECT COUNT(*) FROM party_members m WHERE m.party_id = parties.id) >= capacity
    `).bind(partyId).run();
  }

  async removeMember(partyId: string, nickname: string) {
    const result = await this.database.prepare(`
      DELETE FROM party_members
      WHERE party_id = ?
        AND nickname = ?
        AND role = 'member'
    `).bind(partyId, nickname).run();
    return Boolean(result.meta.changes);
  }

  async reopenIfFutureFull(partyId: string, nowIso: string) {
    await this.database.prepare(`
      UPDATE parties
      SET status = 'open'
      WHERE id = ?
        AND status = 'full'
        AND departure_at > ?
    `).bind(partyId, nowIso).run();
  }

  async cancelParty(partyId: string, leaderNickname: string) {
    const result = await this.database.prepare(`
      UPDATE parties
      SET status = 'cancelled'
      WHERE id = ?
        AND leader_nickname = ?
        AND status != 'cancelled'
    `).bind(partyId, leaderNickname).run();
    return Boolean(result.meta.changes);
  }

  private async loadParties({ partyId, nowIso = new Date().toISOString() }: { partyId?: string; nowIso?: string }) {
    const partyQuery = partyId
      ? this.database.prepare(`
          SELECT p.*, COUNT(m.id) AS member_count, COALESCE(SUM(m.verified_rate), 0) AS total_rate
          FROM parties p
          LEFT JOIN party_members m ON m.party_id = p.id
          WHERE p.id = ?
          GROUP BY p.id
        `).bind(partyId)
      : this.database.prepare(`
          SELECT p.*, COUNT(m.id) AS member_count, COALESCE(SUM(m.verified_rate), 0) AS total_rate
          FROM parties p
          LEFT JOIN party_members m ON m.party_id = p.id
          WHERE p.departure_at > ? AND p.status != 'cancelled'
          GROUP BY p.id
          ORDER BY p.departure_at ASC, p.created_at DESC
        `).bind(nowIso);
    const { results: partyRows } = await partyQuery.all<PartyRow>();
    if (!partyRows.length) return [];

    const memberQuery = partyId
      ? this.database.prepare(`
          SELECT m.*
          FROM party_members m
          WHERE m.party_id = ?
          ORDER BY m.joined_at ASC
        `).bind(partyId)
      : this.database.prepare(`
          SELECT m.*
          FROM party_members m
          JOIN parties p ON p.id = m.party_id
          WHERE p.departure_at > ? AND p.status != 'cancelled'
          ORDER BY m.joined_at ASC
        `).bind(nowIso);
    const { results: memberRows } = await memberQuery.all<MemberRow>();
    const membersByParty = new Map<string, PartyMember[]>();
    for (const row of memberRows) {
      const members = membersByParty.get(row.party_id) ?? [];
      members.push(memberFromRow(row, this.currentUserId));
      membersByParty.set(row.party_id, members);
    }

    return partyRows.map((row) => partyFromRow(row, membersByParty.get(row.id) ?? []));
  }

  private insertRoleContractMember(record: AddPartyMemberRecord) {
    const combatRole = record.combatRole === 'main_dealer' ? 'main_dealer' : 'secondary_dealer';
    const minimumColumn = combatRole === 'main_dealer' ? 'main_minimum_rate' : 'secondary_minimum_rate';
    const capacityColumn = combatRole === 'main_dealer' ? 'main_capacity' : 'secondary_capacity';
    return this.database.prepare(`
      INSERT INTO party_members (
        id, party_id, user_id, nickname, character_class, character_level,
        character_image, hexa_stat, verified_rate, role, combat_role,
        terms_version_agreed, terms_agreed_at, joined_at
      )
      SELECT ?, p.id, ?, ?, ?, ?, ?, ?, ?, 'member', ?, ?, ?, ?
      FROM parties p
      WHERE p.id = ?
        AND p.status = 'open'
        AND p.departure_at > ?
        AND p.format_version = 'role_contract_v2'
        AND p.terms_version = ?
        AND ? >= p.${minimumColumn}
        AND (
          SELECT COUNT(*) FROM party_members m
          WHERE m.party_id = p.id AND m.combat_role = ?
        ) < p.${capacityColumn}
        AND (SELECT COUNT(*) FROM party_members m WHERE m.party_id = p.id) < p.capacity
    `).bind(
      crypto.randomUUID(),
      record.userId,
      record.nickname,
      record.characterClass,
      record.characterLevel,
      record.characterImage ?? null,
      record.hexaStat,
      record.verifiedRate,
      combatRole,
      record.termsVersion,
      record.joinedAt,
      record.joinedAt,
      record.partyId,
      record.joinedAt,
      record.termsVersion,
      record.verifiedRate,
      combatRole,
    ).run();
  }

  private insertLegacyMember(record: AddPartyMemberRecord) {
    return this.database.prepare(`
      INSERT INTO party_members (
        id, party_id, user_id, nickname, character_class, character_level,
        character_image, hexa_stat, verified_rate, role, joined_at
      )
      SELECT ?, p.id, ?, ?, ?, ?, ?, ?, ?, 'member', ?
      FROM parties p
      WHERE p.id = ?
        AND p.status = 'open'
        AND p.departure_at > ?
        AND ? >= p.minimum_rate
        AND (SELECT COUNT(*) FROM party_members m WHERE m.party_id = p.id) < p.capacity
    `).bind(
      crypto.randomUUID(),
      record.userId,
      record.nickname,
      record.characterClass,
      record.characterLevel,
      record.characterImage ?? null,
      record.hexaStat,
      record.verifiedRate,
      record.joinedAt,
      record.partyId,
      record.joinedAt,
      record.verifiedRate,
    ).run();
  }
}
