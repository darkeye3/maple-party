const API_BASE = 'https://open.api.nexon.com/maplestory/v1';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;
type NexonError = { error?: { name?: string; message?: string }; name?: string; message?: string };
type Achievement = {
  achievement_name?: string;
  achievement_description?: string;
};

async function nexonFetch(url: string, headers: Record<string, string>) {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(url, { headers });
    if (response.status !== 429 && response.status < 500) return response;
    const retryAfter = Number(response.headers.get('retry-after')) * 1000;
    await new Promise((resolve) => setTimeout(resolve, retryAfter || 300 * (2 ** attempt)));
  }
  return response as Response;
}

async function upstreamError(response: Response, endpoint: string) {
  const body = await response.json().catch(() => ({})) as NexonError;
  const message = body.error?.message ?? body.message;
  return Response.json({
    error: message ? `NEXON API 오류: ${message}` : `NEXON API의 ${endpoint} 조회가 실패했습니다.`,
    code: 'NEXON_UPSTREAM_ERROR',
    endpoint,
    upstreamStatus: response.status,
  }, { status: 502 });
}

function collectCharacterNames(value: JsonValue, names = new Set<string>()) {
  if (Array.isArray(value)) {
    for (const item of value) collectCharacterNames(item, names);
    return names;
  }
  if (!value || typeof value !== 'object') return names;
  const record = value as JsonRecord;
  if (typeof record.character_name === 'string') names.add(record.character_name);
  for (const item of Object.values(record)) collectCharacterNames(item, names);
  return names;
}

function collectAchievements(value: JsonValue, achievements: Achievement[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectAchievements(item, achievements);
    return achievements;
  }
  if (!value || typeof value !== 'object') return achievements;
  const record = value as JsonRecord;
  if (typeof record.achievement_name === 'string') {
    achievements.push({
      achievement_name: record.achievement_name,
      achievement_description: typeof record.achievement_description === 'string' ? record.achievement_description : undefined,
    });
  }
  for (const item of Object.values(record)) collectAchievements(item, achievements);
  return achievements;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nickname = requestUrl.searchParams.get('nickname')?.trim() ?? '';
  const keyword = requestUrl.searchParams.get('keyword')?.trim() || '검은 마법사';
  const requestApiKey = request.headers.get('x-nexon-api-key')?.trim();
  const apiKey = process.env.NEXON_API_KEY || requestApiKey;
  if (!apiKey) return Response.json({ error: 'NEXON Open API 키가 필요합니다.', code: 'API_KEY_REQUIRED' }, { status: 401 });

  const headers = { 'x-nxopen-api-key': apiKey };
  const [characterListResponse, achievementResponse] = await Promise.all([
    nexonFetch(`${API_BASE}/character/list`, headers),
    nexonFetch(`${API_BASE}/user/achievement`, headers),
  ]);
  if (!characterListResponse.ok) return upstreamError(characterListResponse, '캐릭터 목록');
  if (!achievementResponse.ok) return upstreamError(achievementResponse, '업적 정보');

  const [characterList, achievementPayload] = await Promise.all([
    characterListResponse.json() as Promise<JsonValue>,
    achievementResponse.json() as Promise<JsonValue>,
  ]);
  const characterNames = [...collectCharacterNames(characterList)].sort((a, b) => a.localeCompare(b, 'ko-KR'));
  const keywordVariants = [...new Set([keyword, keyword.replace(/\s+/g, ''), 'Black Mage'].filter(Boolean))];
  const matches = collectAchievements(achievementPayload).filter((achievement) => {
    const target = `${achievement.achievement_name ?? ''} ${achievement.achievement_description ?? ''}`;
    const compactTarget = target.replace(/\s+/g, '');
    return keywordVariants.some((variant) => target.includes(variant) || compactTarget.includes(variant.replace(/\s+/g, '')));
  });

  return Response.json({
    nickname,
    characterInApiAccount: nickname ? characterNames.includes(nickname) : null,
    characterNames,
    keyword,
    matchedCount: matches.length,
    matches,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
