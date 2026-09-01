import { ensurePartySchema, partyDatabase } from '@/lib/db';
import { AuthRepository } from '@/lib/server/auth-repository';
import { AuthRequestError, AuthService } from '@/lib/server/auth-service';

function createAuthService() {
  return new AuthService(new AuthRepository(partyDatabase()));
}

function authResponse(body: unknown, status = 200, cookie?: string) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  });
}

export async function GET(request: Request) {
  try {
    await ensurePartySchema();
    const { user } = await createAuthService().currentUser(request);
    return authResponse({ user });
  } catch (error) {
    return authResponse(
      { error: error instanceof Error ? error.message : '로그인 상태를 확인하지 못했습니다.' },
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensurePartySchema();
    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const service = createAuthService();
    if (action === 'register') {
      const { user, cookie } = await service.register(body, request.url);
      return authResponse({ user }, 201, cookie);
    }
    if (action === 'login') {
      const { user, cookie } = await service.login(body, request.url);
      return authResponse({ user }, 200, cookie);
    }
    if (action === 'logout') {
      const { user, cookie } = await service.logout(request, request.url);
      return authResponse({ user }, 200, cookie);
    }
    throw new AuthRequestError('지원하지 않는 로그인 요청입니다.');
  } catch (error) {
    if (error instanceof AuthRequestError) {
      return authResponse({ error: error.message }, error.status);
    }
    return authResponse(
      { error: error instanceof Error ? error.message : '로그인 요청을 처리하지 못했습니다.' },
      500,
    );
  }
}
