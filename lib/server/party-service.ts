import { getBossDefinition } from '@/lib/model';
import type { AuthUser } from '@/lib/auth';
import type { CombatRole, PartyActionResponse, PartyPost, RewardPreset } from '@/lib/parties';
import { PartyRequestError } from '@/lib/server/party-errors';
import type { PartyRepository } from '@/lib/server/party-repository';
import type { VerifiedPartyCharacter } from '@/lib/server/party-character-verifier';

export type CharacterVerifier = (nickname: string, hexaStat: number, bossId: string) => Promise<VerifiedPartyCharacter>;

export type PartyServiceResponse = {
  body: PartyActionResponse | { synced: true };
  status?: number;
};

export function numeric(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function characterImageValue(value: unknown) {
  try {
    const image = new URL(textValue(value));
    return image.protocol === 'https:' && image.hostname === 'open.api.nexon.com' ? image.toString() : '';
  } catch {
    return '';
  }
}

function validateDeparture(value: unknown) {
  const departure = new Date(String(value));
  const now = Date.now();
  if (!Number.isFinite(departure.getTime())) throw new PartyRequestError('출발 시간을 확인해 주세요.');
  if (departure.getTime() < now + 10 * 60_000) throw new PartyRequestError('출발 시간은 현재보다 10분 이후여야 합니다.');
  if (departure.getTime() > now + 30 * 24 * 60 * 60_000) throw new PartyRequestError('출발 시간은 30일 이내로 정해 주세요.');
  return departure.toISOString();
}

function isCombatRole(value: unknown): value is CombatRole {
  return value === 'main_dealer' || value === 'secondary_dealer';
}

function combatRoleValue(value: unknown) {
  return isCombatRole(value) ? value : undefined;
}

function isRewardPreset(value: unknown): value is RewardPreset {
  return value === 'equal_all'
    || value === 'main_loot_equal_crystal'
    || value === 'main_loot_adjusted_crystal';
}

function rewardPresetValue(value: unknown) {
  return isRewardPreset(value) ? value : undefined;
}

function roleMinimumRate(party: PartyPost, combatRole: CombatRole | undefined) {
  if (party.formatVersion !== 'role_contract_v2') return party.minimumRate;
  return combatRole === 'main_dealer' ? party.mainMinimumRate ?? 0 : party.secondaryMinimumRate ?? 0;
}

function memberHasRoleSeat(party: PartyPost, combatRole: CombatRole) {
  const roleCapacity = combatRole === 'main_dealer' ? party.mainCapacity ?? 0 : party.secondaryCapacity ?? 0;
  const roleMemberCount = party.members.filter((member) => member.combatRole === combatRole).length;
  return roleMemberCount < roleCapacity;
}

export class PartyService {
  constructor(
    private readonly repository: PartyRepository,
    private readonly verifyCharacter: CharacterVerifier,
    private readonly currentUser: AuthUser | null = null,
  ) {}

  async listParties() {
    return this.repository.listActiveParties();
  }

  async handleAction(body: Record<string, unknown>): Promise<PartyServiceResponse> {
    const action = textValue(body.action);
    if (action === 'sync-profile') return { body: await this.syncProfile(body) };
    if (action === 'create') return { body: { party: await this.createParty(body) }, status: 201 };
    if (action === 'join') return { body: { party: await this.joinParty(body) } };
    if (action === 'leave') return { body: { party: await this.leaveParty(body) } };
    if (action === 'delete') return { body: { parties: await this.deleteParty(body) } };
    throw new PartyRequestError('지원하지 않는 파티 요청입니다.');
  }

  private async syncProfile(body: Record<string, unknown>) {
    const nickname = textValue(body.nickname).trim();
    const characterImage = characterImageValue(body.characterImage);
    if (!nickname || !characterImage) throw new PartyRequestError('동기화할 공식 캐릭터 이미지를 확인하지 못했습니다.');
    await this.repository.syncActiveMemberImage(nickname, characterImage);
    return { synced: true as const };
  }

  private async createParty(body: Record<string, unknown>) {
    const currentUser = this.requireCurrentUser();
    const bossId = textValue(body.bossId);
    const boss = getBossDefinition(bossId);
    if (!boss || boss.partyLimit < 2) throw new PartyRequestError('파티 모집을 지원하지 않는 보스입니다.');

    const capacity = numeric(body.capacity);
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > boss.partyLimit) {
      throw new PartyRequestError(`모집 인원은 2명부터 최대 ${boss.partyLimit}명까지 선택할 수 있습니다.`);
    }

    const roleContract = textValue(body.formatVersion) === 'role_contract_v2';
    const requiredPartyRate = roleContract ? numeric(body.requiredPartyRate) : undefined;
    const mainCapacity = roleContract ? numeric(body.mainCapacity) : undefined;
    const mainMinimumRate = roleContract ? numeric(body.mainMinimumRate) : undefined;
    const secondaryCapacity = roleContract ? capacity - numeric(body.mainCapacity) : undefined;
    const secondaryMinimumRate = roleContract ? numeric(body.secondaryMinimumRate) : undefined;
    const rewardPreset = roleContract ? rewardPresetValue(body.rewardPreset) : undefined;
    const secondaryCrystalShare = roleContract && rewardPreset === 'main_loot_adjusted_crystal'
      ? numeric(body.secondaryCrystalShare)
      : 100;
    const leaderCombatRole = roleContract ? combatRoleValue(body.leaderCombatRole) : undefined;

    if (roleContract) {
      if (!requiredPartyRate || requiredPartyRate < 1 || requiredPartyRate > 1000) {
        throw new PartyRequestError('목표 파티 배율은 1%부터 1,000% 사이로 정해 주세요.');
      }
      if (!Number.isInteger(mainCapacity) || !mainCapacity || mainCapacity < 1 || mainCapacity > capacity) {
        throw new PartyRequestError('메인격수 자리 수를 확인해 주세요.');
      }
      if ((mainMinimumRate ?? 0) < 1 || (mainMinimumRate ?? 0) > 1000) {
        throw new PartyRequestError('메인격수 최소 배율은 1%부터 1,000% 사이로 정해 주세요.');
      }
      if ((secondaryCapacity ?? 0) > 0 && ((secondaryMinimumRate ?? 0) < 1 || (secondaryMinimumRate ?? 0) > 1000)) {
        throw new PartyRequestError('보조격수 최소 배율은 1%부터 1,000% 사이로 정해 주세요.');
      }
      if (!rewardPreset) throw new PartyRequestError('보상 분배 방식을 확인해 주세요.');
      if (secondaryCrystalShare < 0 || secondaryCrystalShare > 100) {
        throw new PartyRequestError('보조격수 결정석 수령 비율은 0%부터 100% 사이로 정해 주세요.');
      }
      if (!leaderCombatRole) throw new PartyRequestError('파티장의 전투 역할을 선택해 주세요.');
      if (leaderCombatRole === 'secondary_dealer' && !secondaryCapacity) {
        throw new PartyRequestError('보조격수 자리가 없어 파티장을 보조격수로 지정할 수 없습니다.');
      }
    }

    const minimumRate = roleContract
      ? Math.min(mainMinimumRate ?? 1, (secondaryCapacity ?? 0) > 0 ? secondaryMinimumRate ?? 1 : mainMinimumRate ?? 1)
      : numeric(body.minimumRate);
    if (!roleContract && (minimumRate < 1 || minimumRate > 1000)) {
      throw new PartyRequestError('최소 배율은 1%부터 1,000% 사이로 정해 주세요.');
    }

    const departureAt = validateDeparture(body.departureAt);
    const nickname = textValue(body.nickname).trim();
    const hexaStat = numeric(body.hexaStat);
    const verified = await this.verifyCharacter(nickname, hexaStat, bossId);
    const leaderMinimumRate = roleContract
      ? leaderCombatRole === 'main_dealer' ? mainMinimumRate ?? 0 : secondaryMinimumRate ?? 0
      : minimumRate;
    if (verified.rate < leaderMinimumRate) {
      throw new PartyRequestError(`파티장 배율 ${verified.rate.toFixed(2)}%가 선택한 역할의 최소 배율보다 낮습니다.`);
    }

    const partyId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await this.repository.createPartyWithLeader({
      partyId,
      memberId,
      bossId: boss.id,
      bossName: boss.name,
      difficulty: boss.difficulty,
      capacity,
      minimumRate,
      departureAt,
      leaderNickname: nickname,
      leaderHexa: hexaStat,
      leaderRate: verified.rate,
      formatVersion: roleContract ? 'role_contract_v2' : 'legacy',
      requiredPartyRate,
      mainCapacity,
      mainMinimumRate,
      secondaryCapacity,
      secondaryMinimumRate,
      rewardPreset,
      secondaryCrystalShare,
      leaderCombatRole,
      leaderCharacterClass: verified.profile.characterClass,
      leaderCharacterLevel: verified.profile.level,
      leaderCharacterImage: verified.profile.image,
      leaderUserId: currentUser.id,
      shareCode: createShareCode(),
      createdAt,
    });
    return this.reloadParty(partyId);
  }

  private async joinParty(body: Record<string, unknown>) {
    const currentUser = this.requireCurrentUser();
    const partyId = textValue(body.partyId);
    const currentParty = await this.requireParty(partyId);
    if (currentParty.status !== 'open' || currentParty.members.length >= currentParty.capacity) {
      throw new PartyRequestError('이미 모집이 완료된 파티입니다.', 409);
    }
    if (new Date(currentParty.departureAt).getTime() <= Date.now()) throw new PartyRequestError('이미 출발 시간이 지난 파티입니다.', 409);

    const nickname = textValue(body.nickname).trim();
    const hexaStat = numeric(body.hexaStat);
    if (currentParty.members.some((member) => member.nickname === nickname)) {
      throw new PartyRequestError('이미 이 파티에 가입한 캐릭터입니다.', 409);
    }
    if (currentParty.members.some((member) => member.isCurrentUser)) {
      throw new PartyRequestError('현재 로그인 계정은 이미 이 파티에 참가 중입니다.', 409);
    }

    const roleContract = currentParty.formatVersion === 'role_contract_v2';
    const combatRole = roleContract ? combatRoleValue(body.combatRole) : undefined;
    const termsVersion = roleContract ? numeric(body.termsVersion) : undefined;
    if (roleContract) {
      if (!combatRole) throw new PartyRequestError('가입할 전투 역할을 선택해 주세요.');
      if (body.termsAccepted !== true) throw new PartyRequestError('보상 약정을 확인하고 동의해 주세요.');
      if (termsVersion !== currentParty.termsVersion) {
        throw new PartyRequestError('파티 조건이 변경되었습니다. 최신 약정을 다시 확인해 주세요.', 409);
      }
      if (!memberHasRoleSeat(currentParty, combatRole)) throw new PartyRequestError('선택한 역할의 모집이 완료되었습니다.', 409);
    }

    const verified = await this.verifyCharacter(nickname, hexaStat, currentParty.bossId);
    const minimumRate = roleMinimumRate(currentParty, combatRole);
    if (verified.rate < minimumRate) {
      throw new PartyRequestError(`가입 배율 ${verified.rate.toFixed(2)}%가 선택한 역할의 최소 ${minimumRate.toFixed(2)}%보다 낮습니다.`, 403);
    }

    const joinedAt = new Date().toISOString();
    try {
      const inserted = await this.repository.addMemberIfEligible({
        partyId,
        nickname,
        characterClass: verified.profile.characterClass,
        characterLevel: verified.profile.level,
        characterImage: verified.profile.image,
        hexaStat,
        verifiedRate: verified.rate,
        combatRole,
        termsVersion,
        userId: currentUser.id,
        joinedAt,
      }, roleContract);
      if (!inserted) throw new PartyRequestError('모집이 마감되었거나 가입 조건이 변경되었습니다.', 409);
    } catch (error) {
      if (error instanceof PartyRequestError) throw error;
      if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) throw new PartyRequestError('이미 이 파티에 가입한 계정 또는 캐릭터입니다.', 409);
      throw error;
    }

    if (roleContract) await this.repository.lockTermsIfUnset(partyId, joinedAt);
    await this.repository.markFullIfCapacityReached(partyId);
    return this.reloadParty(partyId);
  }

  private async leaveParty(body: Record<string, unknown>) {
    this.requireCurrentUser();
    const partyId = textValue(body.partyId);
    const currentParty = await this.requireParty(partyId);
    if (currentParty.status === 'cancelled') throw new PartyRequestError('이미 삭제된 모집 글입니다.', 409);

    const member = currentParty.members.find((item) => item.isCurrentUser);
    if (!member) throw new PartyRequestError('이 파티에 참가 중인 캐릭터가 아닙니다.', 404);
    if (member.role === 'leader') throw new PartyRequestError('파티장은 탈퇴 대신 모집 삭제를 이용해 주세요.', 403);

    const leftAt = new Date().toISOString();
    const removed = await this.repository.removeMember(partyId, member.nickname);
    if (!removed) throw new PartyRequestError('탈퇴할 파티 참가 정보를 찾지 못했습니다.', 404);
    await this.repository.reopenIfFutureFull(partyId, leftAt);
    return this.reloadParty(partyId);
  }

  private async deleteParty(body: Record<string, unknown>) {
    this.requireCurrentUser();
    const partyId = textValue(body.partyId);
    const currentParty = await this.requireParty(partyId);
    if (currentParty.status === 'cancelled') throw new PartyRequestError('이미 삭제된 모집 글입니다.', 409);

    const member = currentParty.members.find((item) => item.isCurrentUser);
    if (!member || member.role !== 'leader' || currentParty.leaderNickname !== member.nickname) {
      throw new PartyRequestError('파티장만 모집 글을 삭제할 수 있습니다.', 403);
    }

    const cancelled = await this.repository.cancelParty(partyId, member.nickname);
    if (!cancelled) throw new PartyRequestError('삭제할 모집 글을 찾지 못했습니다.', 404);
    return this.repository.listActiveParties();
  }

  private async requireParty(partyId: string) {
    const party = await this.repository.findPartyById(partyId);
    if (!party) throw new PartyRequestError('모집 글을 찾을 수 없습니다.', 404);
    return party;
  }

  private async reloadParty(partyId: string) {
    const party = await this.repository.findPartyById(partyId);
    if (!party) throw new PartyRequestError('파티 정보를 다시 불러오지 못했습니다.', 500);
    return party;
  }

  private requireCurrentUser() {
    if (!this.currentUser) throw new PartyRequestError('로그인 후 이용할 수 있습니다.', 401);
    return this.currentUser;
  }
}

function createShareCode() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}
