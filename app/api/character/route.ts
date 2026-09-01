import {
  CharacterLookupError,
  characterLookupErrorPayload,
  lookupCharacterProfile,
} from '@/lib/server/character-service';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nickname = requestUrl.searchParams.get('nickname')?.trim() ?? '';
  const forceRefresh = requestUrl.searchParams.get('refresh') === '1';
  const requestApiKey = request.headers.get('x-nexon-api-key')?.trim() ?? null;

  try {
    const { profile, cacheStatus } = await lookupCharacterProfile(nickname, {
      apiKey: requestApiKey,
      forceRefresh,
    });
    return Response.json(profile, {
      headers: cacheStatus ? { 'X-MapleParty-Profile-Cache': cacheStatus } : {},
    });
  } catch (error) {
    if (error instanceof CharacterLookupError) {
      return Response.json(characterLookupErrorPayload(error), { status: error.status });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : '캐릭터 정보를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}
