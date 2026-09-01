import type { AuthUser } from '@/lib/auth';
import type { AuthRepository } from '@/lib/server/auth-repository';

const SESSION_COOKIE = 'maple_party_session';
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const PASSWORD_HASH_ITERATIONS = 80_000;

type AuthActionResult = {
  user: AuthUser | null;
  cookie?: string;
};

export class AuthRequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function normalizeLoginName(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDisplayName(value: unknown, fallback: string) {
  const displayName = typeof value === 'string' ? value.trim() : '';
  return displayName || fallback;
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function validateLoginName(loginName: string) {
  if (!/^[\p{L}\p{N}_-]{2,20}$/u.test(loginName)) {
    throw new AuthRequestError('아이디는 2~20자의 한글, 영문, 숫자, _, - 만 사용할 수 있습니다.');
  }
}

function validatePassword(password: string) {
  if (password.length < 6 || password.length > 72) {
    throw new AuthRequestError('비밀번호는 6~72자로 입력해 주세요.');
  }
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hashPassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PASSWORD_HASH_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

function safeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function publicUser(user: AuthUser): AuthUser {
  return {
    id: user.id,
    loginName: user.loginName,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

function sessionCookie(sessionId: string, expiresAt: string, requestUrl: string) {
  const secure = new URL(requestUrl).protocol === 'https:';
  const maxAge = Math.max(1, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return [
    `${SESSION_COOKIE}=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function clearSessionCookie(requestUrl: string) {
  const secure = new URL(requestUrl).protocol === 'https:';
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function sessionIdFromRequest(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}

export async function getCurrentAuthUser(request: Request, repository: AuthRepository) {
  const sessionId = sessionIdFromRequest(request);
  if (!sessionId) return null;
  const session = await repository.findSessionUser(sessionId);
  return session ? publicUser(session) : null;
}

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async currentUser(request: Request): Promise<AuthActionResult> {
    await this.repository.deleteExpiredSessions();
    return { user: await getCurrentAuthUser(request, this.repository) };
  }

  async register(body: Record<string, unknown>, requestUrl: string): Promise<AuthActionResult> {
    const loginName = normalizeLoginName(body.loginName);
    const password = textValue(body.password);
    validateLoginName(loginName);
    validatePassword(password);

    const displayName = normalizeDisplayName(body.displayName, loginName);
    const salt = randomBytes(16);
    const passwordHash = await hashPassword(password, salt);
    const nowIso = new Date().toISOString();
    const user: AuthUser = {
      id: crypto.randomUUID(),
      loginName,
      displayName,
      createdAt: nowIso,
    };

    try {
      await this.repository.createUser({
        id: user.id,
        loginName,
        displayName,
        passwordSalt: bytesToBase64Url(salt),
        passwordHash,
        nowIso,
      });
    } catch (error) {
      if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) {
        throw new AuthRequestError('이미 사용 중인 아이디입니다.', 409);
      }
      throw error;
    }

    return this.createSessionFor(user, requestUrl);
  }

  async login(body: Record<string, unknown>, requestUrl: string): Promise<AuthActionResult> {
    const loginName = normalizeLoginName(body.loginName);
    const password = textValue(body.password);
    validateLoginName(loginName);
    validatePassword(password);

    const user = await this.repository.findUserByLoginName(loginName);
    if (!user) throw new AuthRequestError('아이디 또는 비밀번호가 맞지 않습니다.', 401);

    const passwordHash = await hashPassword(password, base64UrlToBytes(user.passwordSalt));
    if (!safeEqual(passwordHash, user.passwordHash)) {
      throw new AuthRequestError('아이디 또는 비밀번호가 맞지 않습니다.', 401);
    }

    return this.createSessionFor(user, requestUrl);
  }

  async logout(request: Request, requestUrl: string): Promise<AuthActionResult> {
    const sessionId = sessionIdFromRequest(request);
    if (sessionId) await this.repository.deleteSession(sessionId);
    return { user: null, cookie: clearSessionCookie(requestUrl) };
  }

  private async createSessionFor(user: AuthUser, requestUrl: string): Promise<AuthActionResult> {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expiresAt = new Date(now + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
    const sessionId = bytesToBase64Url(randomBytes(32));
    await this.repository.createSession(sessionId, user.id, expiresAt, nowIso);
    return { user: publicUser(user), cookie: sessionCookie(sessionId, expiresAt, requestUrl) };
  }
}
