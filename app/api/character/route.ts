import { REFERENCE_PROFILE } from '@/lib/model';
import { optimizePresets } from '@/lib/presets';

const API_BASE = 'https://open.api.nexon.com/maplestory/v1';
type FinalStat = { stat_name: string; stat_value: string };
type NexonError = { error?: { name?: string; message?: string }; name?: string; message?: string };

function numeric(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return 0;
  return Number(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

function statValue(stats: FinalStat[], names: string[]) {
  return numeric(stats.find((item) => names.includes(item.stat_name))?.stat_value);
}

async function nexonFetch(url: string, headers: Record<string, string>) {
  let response = await fetch(url, { headers });
  if (response.status === 429 || response.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    response = await fetch(url, { headers });
  }
  return response;
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

async function optionalJson(path: string, ocid: string, headers: Record<string, string>) {
  const response = await nexonFetch(`${API_BASE}/${path}?ocid=${encodeURIComponent(ocid)}`, headers);
  return response.ok ? response.json().catch(() => undefined) : undefined;
}

export async function GET(request: Request) {
  const nickname = new URL(request.url).searchParams.get('nickname')?.trim();
  if (!nickname) return Response.json({ error: '닉네임을 입력해 주세요.' }, { status: 400 });
  const requestApiKey = request.headers.get('x-nexon-api-key')?.trim();
  const apiKey = requestApiKey || process.env.NEXON_API_KEY;
  if (!apiKey) {
    if (nickname === REFERENCE_PROFILE.nickname) return Response.json(REFERENCE_PROFILE);
    return Response.json({ error: '다른 캐릭터를 조회하려면 NEXON Open API 키를 연결해 주세요.', code: 'API_KEY_REQUIRED' }, { status: 401 });
  }

  const headers = { 'x-nxopen-api-key': apiKey };
  const idResponse = await nexonFetch(`${API_BASE}/id?character_name=${encodeURIComponent(nickname)}`, headers);
  if (!idResponse.ok) return upstreamError(idResponse, '캐릭터 식별자');
  const { ocid } = await idResponse.json() as { ocid?: string };
  if (!ocid) return Response.json({ error: '캐릭터 식별값을 받지 못했습니다.' }, { status: 502 });

  const [basicResponse, statResponse, symbols, items, ability, hyper, links, union] = await Promise.all([
    nexonFetch(`${API_BASE}/character/basic?ocid=${encodeURIComponent(ocid)}`, headers),
    nexonFetch(`${API_BASE}/character/stat?ocid=${encodeURIComponent(ocid)}`, headers),
    optionalJson('character/symbol-equipment', ocid, headers),
    optionalJson('character/item-equipment', ocid, headers),
    optionalJson('character/ability', ocid, headers),
    optionalJson('character/hyper-stat', ocid, headers),
    optionalJson('character/link-skill', ocid, headers),
    optionalJson('user/union-raider', ocid, headers),
  ]);
  if (!basicResponse.ok) return upstreamError(basicResponse, '기본 정보');
  if (!statResponse.ok) return upstreamError(statResponse, '종합 능력치');
  const [basic, stat] = await Promise.all([
    basicResponse.json(),
    statResponse.json(),
  ]);
  const finalStats = (stat as { final_stat?: FinalStat[] }).final_stat ?? [];
  const symbolItems = (symbols as { symbol?: Array<{ symbol_name?: string; symbol_force?: number }> } | undefined)?.symbol ?? [];
  const symbolForce = (type: string) => symbolItems.filter((symbol) => symbol.symbol_name?.includes(type)).reduce((total, symbol) => total + numeric(symbol.symbol_force), 0);
  const characterClass = (basic as { character_class?: string }).character_class ?? '알 수 없음';
  const currentStats = {
    ignoreDefense: statValue(finalStats, ['방어율 무시']),
    damage: statValue(finalStats, ['데미지']),
    bossDamage: statValue(finalStats, ['보스 몬스터 데미지']),
    criticalRate: statValue(finalStats, ['크리티컬 확률']),
    criticalDamage: statValue(finalStats, ['크리티컬 데미지']),
  };
  const optimized = characterClass === '비숍'
    ? optimizePresets(currentStats, { items, ability, hyper, links, union })
    : undefined;

  return Response.json({
    nickname,
    characterClass,
    level: numeric((basic as { character_level?: number }).character_level),
    image: (basic as { character_image?: string }).character_image,
    arcaneForce: statValue(finalStats, ['아케인포스']) || symbolForce('아케인'),
    authenticForce: statValue(finalStats, ['어센틱포스']) || symbolForce('어센틱'),
    ...(optimized?.profile ?? currentStats),
    bestCondition: optimized?.bestCondition,
    source: 'nexon',
  });
}
