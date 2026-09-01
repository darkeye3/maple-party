import { ensurePartySchema, partyDatabase } from '@/lib/db';
import { verifyPartyCharacter } from '@/lib/server/party-character-verifier';
import { PartyRequestError } from '@/lib/server/party-errors';
import { PartyRepository } from '@/lib/server/party-repository';
import { PartyService } from '@/lib/server/party-service';

function createPartyService(request?: Request) {
  const apiKey = request?.headers.get('x-nexon-api-key')?.trim() ?? null;
  return new PartyService(
    new PartyRepository(partyDatabase()),
    (nickname, hexaStat, bossId) => verifyPartyCharacter({ nickname, hexaStat, bossId, apiKey }),
  );
}

export async function GET() {
  try {
    await ensurePartySchema();
    const service = createPartyService();
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
    const service = createPartyService(request);
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
