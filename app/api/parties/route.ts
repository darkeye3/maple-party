import { ensurePartySchema, partyDatabase } from '@/lib/db';
import { AuthRepository } from '@/lib/server/auth-repository';
import { getCurrentAuthUser } from '@/lib/server/auth-service';
import { verifyPartyCharacter } from '@/lib/server/party-character-verifier';
import { PartyRequestError } from '@/lib/server/party-errors';
import { PartyRepository } from '@/lib/server/party-repository';
import { PartyService } from '@/lib/server/party-service';

async function createPartyService(request?: Request) {
  const apiKey = request?.headers.get('x-nexon-api-key')?.trim() ?? null;
  const database = partyDatabase();
  const currentUser = request
    ? await getCurrentAuthUser(request, new AuthRepository(database))
    : null;
  return new PartyService(
    new PartyRepository(database, currentUser?.id),
    (nickname, hexaStat, bossId) => verifyPartyCharacter({ nickname, hexaStat, bossId, apiKey }),
    currentUser,
  );
}

export async function GET(request: Request) {
  try {
    await ensurePartySchema();
    const service = await createPartyService(request);
    return Response.json(
      { parties: await service.listParties() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '파티 목록을 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensurePartySchema();
    const body = await request.json() as Record<string, unknown>;
    const service = await createPartyService(request);
    const { body: responseBody, status } = await service.handleAction(body);
    return Response.json(responseBody, { status: status ?? 200 });
  } catch (error) {
    if (error instanceof PartyRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : '파티 요청을 처리하지 못했습니다.' },
      { status: 500 },
    );
  }
}
