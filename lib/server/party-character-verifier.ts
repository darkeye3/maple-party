import { calculateBosses, type CharacterProfile } from '@/lib/model';
import { CharacterLookupError, lookupCharacterProfile } from '@/lib/server/character-service';
import { PartyRequestError } from '@/lib/server/party-errors';

export type VerifiedPartyCharacter = {
  profile: CharacterProfile;
  rate: number;
};

export type VerifyPartyCharacterOptions = {
  apiKey?: string | null;
  bossId: string;
  hexaStat: number;
  nickname: string;
};

export async function verifyPartyCharacter({
  apiKey,
  bossId,
  hexaStat,
  nickname,
}: VerifyPartyCharacterOptions): Promise<VerifiedPartyCharacter> {
  const nicknameValue = nickname.trim();
  if (!nicknameValue) throw new PartyRequestError('캐릭터 닉네임을 입력해 주세요.');
  if (!Number.isInteger(hexaStat) || hexaStat < 1 || hexaStat > 250_000) {
    throw new PartyRequestError('헥사환산은 1부터 250,000 사이로 입력해 주세요.');
  }

  let profile: CharacterProfile;
  try {
    ({ profile } = await lookupCharacterProfile(nicknameValue, { apiKey }));
  } catch (error) {
    if (error instanceof CharacterLookupError) {
      throw new PartyRequestError(error.message, error.status >= 500 ? 502 : error.status);
    }
    throw error;
  }

  if (profile.partialData) throw new PartyRequestError('공식 API 일부 응답이 지연되었습니다. 잠시 후 다시 시도해 주세요.', 503);
  if (profile.characterClass !== '비숍') throw new PartyRequestError('현재 파티 배율 검증은 비숍만 지원합니다.');
  const boss = calculateBosses(hexaStat, profile).find((item) => item.id === bossId);
  if (!boss) throw new PartyRequestError('지원하지 않는 보스 또는 난이도입니다.');
  return { profile, rate: boss.rate };
}
