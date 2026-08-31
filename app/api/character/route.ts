import { REFERENCE_PROFILE, type AuthenticRegion, type CharacterCalculationProfile } from '@/lib/model';
import { optimizePresets } from '@/lib/presets';

const API_BASE = 'https://open.api.nexon.com/maplestory/v1';
type FinalStat = { stat_name: string; stat_value: string };
type NexonError = { error?: { name?: string; message?: string }; name?: string; message?: string };
type JsonRecord = Record<string, unknown>;

function numeric(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return 0;
  return Number(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

function statValue(stats: FinalStat[], names: string[]) {
  return numeric(stats.find((item) => names.includes(item.stat_name))?.stat_value);
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function symbolRegion(name: string): AuthenticRegion | undefined {
  if (name.includes('세르니움')) return 'seren';
  if (name.includes('아르크스')) return 'kalos';
  if (name.includes('오디움')) return 'adversary';
  if (name.includes('도원경')) return 'kaling';
  if (name.includes('아르테리아')) return 'malefic';
  if (name.includes('카르시온')) return 'limbo';
  if (name.includes('탈라하트')) return 'bardrix';
  if (name.includes('기어드락')) return 'jupiter';
  return undefined;
}

function authenticSymbolLevels(symbols: Array<{ symbol_name?: string; symbol_level?: number }>) {
  const levels: CharacterCalculationProfile['symbolLevels'] = {};
  for (const symbol of symbols) {
    const region = symbolRegion(symbol.symbol_name ?? '');
    if (!region) continue;
    levels[region] = Math.max(levels[region] ?? 0, numeric(symbol.symbol_level));
  }
  return levels;
}

function maxSpecialRingLevel(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((maximum, item) => Math.max(maximum, maxSpecialRingLevel(item)), 0);
  if (!value || typeof value !== 'object') return 0;
  const record = value as JsonRecord;
  const ownLevel = numeric(record.special_ring_level);
  return Object.values(record).reduce<number>((maximum, item) => Math.max(maximum, maxSpecialRingLevel(item)), ownLevel);
}

function hexaStatLevelTotal(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((total, item) => total + hexaStatLevelTotal(item), 0);
  if (!value || typeof value !== 'object') return 0;
  return Object.entries(value as JsonRecord).reduce((total, [key, item]) => {
    if (/^(?:main_stat_level|sub_stat_level_[12])$/.test(key)) return total + numeric(item);
    return total + hexaStatLevelTotal(item);
  }, 0);
}

function hexaCoreProfile(cores: JsonRecord[], statMatrix: unknown): CharacterCalculationProfile['hexa'] {
  const levels = {
    skill: [] as number[],
    mastery: [] as number[],
    enhancement: [] as number[],
    common: [] as number[],
  };
  let originLevel = 0;
  for (const core of cores) {
    const name = typeof core.hexa_core_name === 'string' ? core.hexa_core_name : '';
    const type = typeof core.hexa_core_type === 'string' ? core.hexa_core_type : '';
    const level = numeric(core.hexa_core_level);
    if (type.includes('마스터리')) levels.mastery.push(level);
    else if (type.includes('강화')) levels.enhancement.push(level);
    else if (type.includes('공용')) levels.common.push(level);
    else if (type.includes('스킬')) levels.skill.push(level);
    if (/홀리 어드밴트|오리진/.test(name)) originLevel = Math.max(originLevel, level);
  }
  if (!originLevel) originLevel = Math.max(0, ...levels.skill);
  return {
    skillAverage: average(levels.skill),
    masteryAverage: average(levels.mastery),
    enhancementAverage: average(levels.enhancement),
    commonAverage: average(levels.common),
    originLevel,
    statLevelTotal: hexaStatLevelTotal(statMatrix),
  };
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

  const [basicResponse, statResponse, symbols, items, ability, hyper, links, union, hexaMatrix, hexaStatMatrix] = await Promise.all([
    nexonFetch(`${API_BASE}/character/basic?ocid=${encodeURIComponent(ocid)}`, headers),
    nexonFetch(`${API_BASE}/character/stat?ocid=${encodeURIComponent(ocid)}`, headers),
    optionalJson('character/symbol-equipment', ocid, headers),
    optionalJson('character/item-equipment', ocid, headers),
    optionalJson('character/ability', ocid, headers),
    optionalJson('character/hyper-stat', ocid, headers),
    optionalJson('character/link-skill', ocid, headers),
    optionalJson('user/union-raider', ocid, headers),
    optionalJson('character/hexamatrix', ocid, headers),
    optionalJson('character/hexamatrix-stat', ocid, headers),
  ]);
  if (!basicResponse.ok) return upstreamError(basicResponse, '기본 정보');
  if (!statResponse.ok) return upstreamError(statResponse, '종합 능력치');
  const [basic, stat] = await Promise.all([
    basicResponse.json(),
    statResponse.json(),
  ]);
  const finalStats = (stat as { final_stat?: FinalStat[] }).final_stat ?? [];
  const symbolItems = (symbols as { symbol?: Array<{ symbol_name?: string; symbol_force?: number; symbol_level?: number }> } | undefined)?.symbol ?? [];
  const symbolForce = (type: string) => symbolItems.filter((symbol) => symbol.symbol_name?.includes(type)).reduce((total, symbol) => total + numeric(symbol.symbol_force), 0);
  const characterClass = (basic as { character_class?: string }).character_class ?? '알 수 없음';
  const hexaCores = ((hexaMatrix as JsonRecord | undefined)?.character_hexa_core_equipment ?? []) as Array<JsonRecord>;
  const hexaStatRecord = (hexaStatMatrix ?? {}) as JsonRecord;
  const hexaStatCoreCount = [
    hexaStatRecord.character_hexa_stat_core,
    hexaStatRecord.character_hexa_stat_core_2,
    hexaStatRecord.character_hexa_stat_core_3,
  ].filter(Boolean).length;
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
  const calculationProfile: CharacterCalculationProfile = {
    mainStat: statValue(finalStats, ['INT', '지력']),
    magicAttack: statValue(finalStats, ['마력', '마법 공격력']),
    finalDamage: statValue(finalStats, ['최종 데미지']),
    statusDamage: statValue(finalStats, ['상태이상 추가 데미지', '상태 이상 추가 데미지']),
    buffDuration: statValue(finalStats, ['버프 지속시간']),
    cooldownReductionSeconds: statValue(finalStats, ['재사용 대기시간 감소 (초)', '재사용 대기시간 감소(초)']),
    cooldownReductionPercent: statValue(finalStats, ['재사용 대기시간 감소 (%)', '재사용 대기시간 감소(%)']),
    ringLevel: maxSpecialRingLevel(items),
    symbolLevels: authenticSymbolLevels(symbolItems),
    hexa: hexaCoreProfile(hexaCores, hexaStatMatrix),
  };

  return Response.json({
    nickname,
    characterClass,
    level: numeric((basic as { character_level?: number }).character_level),
    image: (basic as { character_image?: string }).character_image,
    dataDate: (stat as { date?: string }).date ?? (basic as { date?: string }).date,
    arcaneForce: statValue(finalStats, ['아케인포스']) || symbolForce('아케인'),
    authenticForce: statValue(finalStats, ['어센틱포스']) || symbolForce('어센틱'),
    hexaCoreCount: hexaCores.length,
    hexaCoreLevelTotal: hexaCores.reduce((total, core) => total + numeric(core.hexa_core_level), 0),
    hexaStatCoreCount,
    ...(optimized?.profile ?? currentStats),
    bestCondition: optimized?.bestCondition,
    calculationProfile,
    source: 'nexon',
  });
}
