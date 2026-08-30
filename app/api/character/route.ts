import { REFERENCE_PROFILE } from '@/lib/model';

const API_BASE = 'https://open.api.nexon.com/maplestory/v1';
type FinalStat = { stat_name: string; stat_value: string };

function numeric(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return 0;
  return Number(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

function statValue(stats: FinalStat[], names: string[]) {
  return numeric(stats.find((item) => names.includes(item.stat_name))?.stat_value);
}

export async function GET(request: Request) {
  const nickname = new URL(request.url).searchParams.get('nickname')?.trim();
  if (!nickname) return Response.json({ error: '닉네임을 입력해 주세요.' }, { status: 400 });
  const apiKey = process.env.NEXON_API_KEY;
  if (!apiKey) {
    if (nickname === REFERENCE_PROFILE.nickname) return Response.json(REFERENCE_PROFILE);
    return Response.json({ error: 'NEXON_API_KEY가 연결되지 않아 기준 캐릭터만 조회할 수 있습니다.', code: 'API_NOT_CONFIGURED' }, { status: 503 });
  }

  const headers = { 'x-nxopen-api-key': apiKey };
  const idResponse = await fetch(`${API_BASE}/id?character_name=${encodeURIComponent(nickname)}`, { headers });
  if (!idResponse.ok) return Response.json({ error: '캐릭터를 찾지 못했습니다.' }, { status: idResponse.status });
  const { ocid } = await idResponse.json() as { ocid?: string };
  if (!ocid) return Response.json({ error: '캐릭터 식별값을 받지 못했습니다.' }, { status: 502 });

  const endpoints = ['character/basic', 'character/stat', 'character/symbol-equipment', 'character/hexamatrix', 'character/hexamatrix-stat'];
  const responses = await Promise.all(endpoints.map((endpoint) => fetch(`${API_BASE}/${endpoint}?ocid=${encodeURIComponent(ocid)}`, { headers })));
  if (!responses[0].ok || !responses[1].ok || !responses[2].ok) {
    return Response.json({ error: '공식 API에서 캐릭터 전투 정보를 불러오지 못했습니다.' }, { status: 502 });
  }
  const [basic, stat, symbols, matrix, matrixStat] = await Promise.all(responses.map(async (response) => response.ok ? response.json() : {}));
  const finalStats = (stat as { final_stat?: FinalStat[] }).final_stat ?? [];
  const symbolItems = (symbols as { symbol?: Array<{ symbol_name?: string; symbol_force?: number }> }).symbol ?? [];
  const symbolForce = (type: string) => symbolItems.filter((symbol) => symbol.symbol_name?.includes(type)).reduce((total, symbol) => total + numeric(symbol.symbol_force), 0);

  return Response.json({
    nickname,
    characterClass: (basic as { character_class?: string }).character_class ?? '알 수 없음',
    level: numeric((basic as { character_level?: number }).character_level),
    image: (basic as { character_image?: string }).character_image,
    arcaneForce: statValue(finalStats, ['아케인포스']) || symbolForce('아케인'),
    authenticForce: statValue(finalStats, ['어센틱포스']) || symbolForce('어센틱'),
    ignoreDefense: statValue(finalStats, ['방어율 무시']),
    bossDamage: statValue(finalStats, ['보스 몬스터 데미지']),
    criticalDamage: statValue(finalStats, ['크리티컬 데미지']),
    hexaCoreCount: (matrix as { character_hexa_core_equipment?: unknown[] }).character_hexa_core_equipment?.length ?? 0,
    hexaStatCoreCount: (matrixStat as { character_hexa_stat_core?: unknown[] }).character_hexa_stat_core?.length ?? 0,
    source: 'nexon',
  });
}
