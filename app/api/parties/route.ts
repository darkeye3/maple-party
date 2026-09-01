import { GET as getCharacterResponse } from '@/app/api/character/route';
import { ensurePartySchema, partyDatabase } from '@/lib/db';
import { calculateBosses, type CharacterProfile, getBossDefinition } from '@/lib/model';
import type { PartyMember, PartyPost } from '@/lib/parties';

type PartyRow = {
  id: string;
  boss_id: string;
  boss_name: string;
  difficulty: string;
  capacity: number;
  minimum_rate: number;
  departure_at: string;
  leader_nickname: string;
  leader_hexa: number;
  leader_rate: number;
  status: 'open' | 'full' | 'cancelled';
  created_at: string;
  member_count: number;
  total_rate: number;
};

type MemberRow = {
  id: string;
  party_id: string;
  nickname: string;
  character_class: string;
  character_level: number;
  character_image: string | null;
  hexa_stat: number;
  verified_rate: number;
  role: 'leader' | 'member';
  joined_at: string;
};

class PartyRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function numeric(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function textValue(value: unknown) {
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

function memberFromRow(row: MemberRow): PartyMember {
  return {
    id: row.id,
    nickname: row.nickname,
    characterClass: row.character_class,
    characterLevel: row.character_level,
    characterImage: row.character_image ?? undefined,
    hexaStat: row.hexa_stat,
    verifiedRate: row.verified_rate,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

async function loadParties(partyId?: string) {
  const database = partyDatabase();
  const now = new Date().toISOString();
  const partyQuery = partyId
    ? database.prepare(`
        SELECT p.*, COUNT(m.id) AS member_count, COALESCE(SUM(m.verified_rate), 0) AS total_rate
        FROM parties p
        LEFT JOIN party_members m ON m.party_id = p.id
        WHERE p.id = ?
        GROUP BY p.id
      `).bind(partyId)
    : database.prepare(`
        SELECT p.*, COUNT(m.id) AS member_count, COALESCE(SUM(m.verified_rate), 0) AS total_rate
        FROM parties p
        LEFT JOIN party_members m ON m.party_id = p.id
        WHERE p.departure_at > ? AND p.status != 'cancelled'
        GROUP BY p.id
        ORDER BY p.departure_at ASC, p.created_at DESC
      `).bind(now);
  const { results: partyRows } = await partyQuery.all<PartyRow>();
  if (!partyRows.length) return [];

  const memberQuery = partyId
    ? database.prepare(`
        SELECT m.*
        FROM party_members m
        WHERE m.party_id = ?
        ORDER BY m.joined_at ASC
      `).bind(partyId)
    : database.prepare(`
        SELECT m.*
        FROM party_members m
        JOIN parties p ON p.id = m.party_id
        WHERE p.departure_at > ? AND p.status != 'cancelled'
        ORDER BY m.joined_at ASC
      `).bind(now);
  const { results: memberRows } = await memberQuery.all<MemberRow>();
  const membersByParty = new Map<string, PartyMember[]>();
  for (const row of memberRows) {
    const members = membersByParty.get(row.party_id) ?? [];
    members.push(memberFromRow(row));
    membersByParty.set(row.party_id, members);
  }

  return partyRows.map((row): PartyPost => ({
    id: row.id,
    bossId: row.boss_id,
    bossName: row.boss_name,
    difficulty: row.difficulty,
    capacity: row.capacity,
    minimumRate: row.minimum_rate,
    departureAt: row.departure_at,
    leaderNickname: row.leader_nickname,
    leaderHexa: row.leader_hexa,
    leaderRate: row.leader_rate,
    status: row.member_count >= row.capacity ? 'full' : row.status,
    createdAt: row.created_at,
    totalRate: row.total_rate,
    members: membersByParty.get(row.id) ?? [],
  }));
}

async function verifyCharacter(request: Request, nickname: string, hexaStat: number, bossId: string) {
  if (!nickname.trim()) throw new PartyRequestError('캐릭터 닉네임을 입력해 주세요.');
  if (!Number.isInteger(hexaStat) || hexaStat < 1 || hexaStat > 250_000) {
    throw new PartyRequestError('헥사환산은 1부터 250,000 사이로 입력해 주세요.');
  }
  const characterUrl = new URL('/api/character', request.url);
  characterUrl.searchParams.set('nickname', nickname.trim());
  const forwardedKey = request.headers.get('x-nexon-api-key');
  const characterResponse = await getCharacterResponse(new Request(characterUrl, {
    headers: forwardedKey ? { 'x-nexon-api-key': forwardedKey } : {},
  }));
  const profile = await characterResponse.json() as CharacterProfile & { error?: string };
  if (!characterResponse.ok) throw new PartyRequestError(profile.error ?? '캐릭터 정보를 확인하지 못했습니다.', 502);
  if (profile.partialData) throw new PartyRequestError('공식 API 일부 응답이 지연되었습니다. 잠시 후 다시 시도해 주세요.', 503);
  if (profile.characterClass !== '비숍') throw new PartyRequestError('현재 파티 배율 검증은 비숍만 지원합니다.');
  const boss = calculateBosses(hexaStat, profile).find((item) => item.id === bossId);
  if (!boss) throw new PartyRequestError('지원하지 않는 보스 또는 난이도입니다.');
  return { profile, rate: boss.rate };
}

function validateDeparture(value: unknown) {
  const departure = new Date(String(value));
  const now = Date.now();
  if (!Number.isFinite(departure.getTime())) throw new PartyRequestError('출발 시간을 확인해 주세요.');
  if (departure.getTime() < now + 10 * 60_000) throw new PartyRequestError('출발 시간은 현재보다 10분 이후여야 합니다.');
  if (departure.getTime() > now + 30 * 24 * 60 * 60_000) throw new PartyRequestError('출발 시간은 30일 이내로 정해 주세요.');
  return departure.toISOString();
}

export async function GET() {
  try {
    await ensurePartySchema();
    return Response.json({ parties: await loadParties() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '파티 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensurePartySchema();
    const body = await request.json() as Record<string, unknown>;
    const action = textValue(body.action);
    if (action === 'sync-profile') {
      const nickname = textValue(body.nickname).trim();
      const characterImage = characterImageValue(body.characterImage);
      if (!nickname || !characterImage) throw new PartyRequestError('동기화할 공식 캐릭터 이미지를 확인하지 못했습니다.');
      const database = partyDatabase();
      await database.prepare(`
        UPDATE party_members
        SET character_image = ?
        WHERE nickname = ?
          AND party_id IN (
            SELECT id FROM parties
            WHERE departure_at > ? AND status != 'cancelled'
          )
      `).bind(characterImage, nickname, new Date().toISOString()).run();
      return Response.json({ synced: true });
    }

    if (action === 'create') {
      const bossId = textValue(body.bossId);
      const boss = getBossDefinition(bossId);
      if (!boss || boss.partyLimit < 2) throw new PartyRequestError('파티 모집을 지원하지 않는 보스입니다.');
      const capacity = numeric(body.capacity);
      if (!Number.isInteger(capacity) || capacity < 2 || capacity > boss.partyLimit) {
        throw new PartyRequestError(`모집 인원은 2명부터 최대 ${boss.partyLimit}명까지 선택할 수 있습니다.`);
      }
      const minimumRate = numeric(body.minimumRate);
      if (minimumRate < 1 || minimumRate > 1000) throw new PartyRequestError('최소 배율은 1%부터 1,000% 사이로 정해 주세요.');
      const departureAt = validateDeparture(body.departureAt);
      const nickname = textValue(body.nickname).trim();
      const hexaStat = numeric(body.hexaStat);
      const verified = await verifyCharacter(request, nickname, hexaStat, bossId);
      if (verified.rate < minimumRate) {
        throw new PartyRequestError(`파티장 배율 ${verified.rate.toFixed(2)}%가 최소 배율보다 낮습니다.`);
      }

      const database = partyDatabase();
      const partyId = crypto.randomUUID();
      const memberId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await database.batch([
        database.prepare(`
          INSERT INTO parties (
            id, boss_id, boss_name, difficulty, capacity, minimum_rate, departure_at,
            leader_nickname, leader_hexa, leader_rate, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
        `).bind(
          partyId, boss.id, boss.name, boss.difficulty, capacity, minimumRate, departureAt,
          nickname, hexaStat, verified.rate, createdAt,
        ),
        database.prepare(`
          INSERT INTO party_members (
            id, party_id, nickname, character_class, character_level,
            character_image, hexa_stat, verified_rate, role, joined_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'leader', ?)
        `).bind(
          memberId, partyId, nickname, verified.profile.characterClass, verified.profile.level,
          verified.profile.image ?? null, hexaStat, verified.rate, createdAt,
        ),
      ]);
      return Response.json({ party: (await loadParties(partyId))[0] }, { status: 201 });
    }

    if (action === 'join') {
      const partyId = textValue(body.partyId);
      const currentParty = (await loadParties(partyId))[0];
      if (!currentParty) throw new PartyRequestError('모집 글을 찾을 수 없습니다.', 404);
      if (currentParty.status !== 'open' || currentParty.members.length >= currentParty.capacity) {
        throw new PartyRequestError('이미 모집이 완료된 파티입니다.', 409);
      }
      if (new Date(currentParty.departureAt).getTime() <= Date.now()) throw new PartyRequestError('이미 출발 시간이 지난 파티입니다.', 409);
      const nickname = textValue(body.nickname).trim();
      const hexaStat = numeric(body.hexaStat);
      if (currentParty.members.some((member) => member.nickname === nickname)) {
        throw new PartyRequestError('이미 이 파티에 가입한 캐릭터입니다.', 409);
      }
      const verified = await verifyCharacter(request, nickname, hexaStat, currentParty.bossId);
      if (verified.rate < currentParty.minimumRate) {
        throw new PartyRequestError(`가입 배율 ${verified.rate.toFixed(2)}%가 최소 ${currentParty.minimumRate.toFixed(2)}%보다 낮습니다.`, 403);
      }

      const database = partyDatabase();
      const joinedAt = new Date().toISOString();
      try {
        const result = await database.prepare(`
          INSERT INTO party_members (
            id, party_id, nickname, character_class, character_level,
            character_image, hexa_stat, verified_rate, role, joined_at
          )
          SELECT ?, p.id, ?, ?, ?, ?, ?, ?, 'member', ?
          FROM parties p
          WHERE p.id = ?
            AND p.status = 'open'
            AND p.departure_at > ?
            AND ? >= p.minimum_rate
            AND (SELECT COUNT(*) FROM party_members m WHERE m.party_id = p.id) < p.capacity
        `).bind(
          crypto.randomUUID(), nickname, verified.profile.characterClass, verified.profile.level,
          verified.profile.image ?? null, hexaStat, verified.rate, joinedAt, partyId, joinedAt, verified.rate,
        ).run();
        if (!result.meta.changes) throw new PartyRequestError('모집이 마감되었거나 가입 조건이 변경되었습니다.', 409);
      } catch (error) {
        if (error instanceof PartyRequestError) throw error;
        if (error instanceof Error && /UNIQUE/i.test(error.message)) throw new PartyRequestError('이미 이 파티에 가입한 캐릭터입니다.', 409);
        throw error;
      }
      await database.prepare(`
        UPDATE parties
        SET status = 'full'
        WHERE id = ?
          AND (SELECT COUNT(*) FROM party_members m WHERE m.party_id = parties.id) >= capacity
      `).bind(partyId).run();
      return Response.json({ party: (await loadParties(partyId))[0] });
    }

    throw new PartyRequestError('지원하지 않는 파티 요청입니다.');
  } catch (error) {
    if (error instanceof PartyRequestError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: error instanceof Error ? error.message : '파티 요청을 처리하지 못했습니다.' }, { status: 500 });
  }
}
