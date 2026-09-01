import { ensurePartySchema, partyDatabase } from '@/lib/db';
import { AuthRepository } from '@/lib/server/auth-repository';
import { getCurrentAuthUser } from '@/lib/server/auth-service';
import { UserCharacterRepository } from '@/lib/server/user-character-repository';

class CharacterRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function numeric(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value.replace(/,/g, ''));
  return Number.NaN;
}

function validateSaveBody(body: Record<string, unknown>) {
  const nickname = textValue(body.nickname);
  const characterClass = textValue(body.characterClass);
  const characterImage = textValue(body.characterImage) || null;
  const hexaStat = numeric(body.hexaStat);
  const characterLevel = numeric(body.characterLevel);
  const arcaneForce = numeric(body.arcaneForce);
  const authenticForce = numeric(body.authenticForce);

  if (!nickname || nickname.length > 12) throw new CharacterRequestError('등록할 캐릭터 닉네임을 확인해 주세요.');
  if (!Number.isInteger(hexaStat) || hexaStat < 1 || hexaStat > 300000) throw new CharacterRequestError('헥사환산은 1부터 300,000 사이로 등록해 주세요.');
  if (!characterClass || characterClass.length > 20) throw new CharacterRequestError('캐릭터 직업 정보를 먼저 조회해 주세요.');
  if (!Number.isInteger(characterLevel) || characterLevel < 1 || characterLevel > 350) throw new CharacterRequestError('캐릭터 레벨 정보를 먼저 조회해 주세요.');

  return {
    nickname,
    hexaStat,
    characterClass,
    characterLevel,
    characterImage,
    arcaneForce: Number.isFinite(arcaneForce) ? Math.max(0, Math.round(arcaneForce)) : 0,
    authenticForce: Number.isFinite(authenticForce) ? Math.max(0, Math.round(authenticForce)) : 0,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function currentUserOrThrow(request: Request) {
  const database = partyDatabase();
  const user = await getCurrentAuthUser(request, new AuthRepository(database));
  if (!user) throw new CharacterRequestError('로그인 후 캐릭터를 등록할 수 있습니다.', 401);
  return { database, user };
}

export async function GET(request: Request) {
  try {
    await ensurePartySchema();
    const { database, user } = await currentUserOrThrow(request);
    const repository = new UserCharacterRepository(database);
    return jsonResponse({ characters: await repository.listByUser(user.id) });
  } catch (error) {
    if (error instanceof CharacterRequestError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: error instanceof Error ? error.message : '내 캐릭터를 불러오지 못했습니다.' }, 500);
  }
}

export async function POST(request: Request) {
  try {
    await ensurePartySchema();
    const { database, user } = await currentUserOrThrow(request);
    const body = await request.json() as Record<string, unknown>;
    const action = textValue(body.action) || 'save';
    const repository = new UserCharacterRepository(database);

    if (action === 'delete') {
      const characterId = textValue(body.characterId);
      if (!characterId) throw new CharacterRequestError('삭제할 캐릭터를 찾지 못했습니다.');
      const deleted = await repository.deleteById(user.id, characterId);
      if (!deleted) throw new CharacterRequestError('삭제할 캐릭터를 찾지 못했습니다.', 404);
      return jsonResponse({ characters: await repository.listByUser(user.id) });
    }

    if (action === 'save') {
      const values = validateSaveBody(body);
      const character = await repository.upsert({
        id: crypto.randomUUID(),
        userId: user.id,
        ...values,
        nowIso: new Date().toISOString(),
      });
      if (!character) throw new CharacterRequestError('캐릭터 등록 결과를 다시 불러오지 못했습니다.', 500);
      const characters = await repository.listByUser(user.id);
      return jsonResponse({ character, characters }, 201);
    }

    throw new CharacterRequestError('지원하지 않는 캐릭터 요청입니다.');
  } catch (error) {
    if (error instanceof CharacterRequestError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: error instanceof Error ? error.message : '내 캐릭터 요청을 처리하지 못했습니다.' }, 500);
  }
}
