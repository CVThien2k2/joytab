# Auth Session & Device Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Google login vào DB (Device/DeviceUser/UserSession/RefreshToken), hỗ trợ refresh + rotation + reuse detection, switch account tức thì, logout và revoke session.

**Architecture:** NestJS + Prisma (PostgreSQL). Tách `auth/session.service.ts` (vòng đời session + refresh token, reuse detection) và `auth/device.service.ts` (device + device_user). `AuthService` orchestrate trong Prisma `$transaction`. DB là nguồn sự thật duy nhất cho refresh/session; Redis chỉ giữ one-time login code. Access token là JWT HS256 stateless 1h. Cookie `refresh_token` HttpOnly path `/auth`.

**Tech Stack:** NestJS 11, Prisma (driver adapter pg), jsonwebtoken, class-validator, Jest + ts-jest + @nestjs/testing.

**Test strategy:** Unit test với mock `DatabaseService` (Prisma) và `TokenService` — không cần Postgres thật. Mỗi service nhận `tx` (Prisma transaction client) qua tham số nên mock dễ dàng.

Spec gốc: `docs/superpowers/specs/2026-06-04-auth-session-device-management-design.md`.

---

## File structure

| File | Trách nhiệm | Create/Modify |
|---|---|---|
| `api/package.json` | thêm devDeps + script `test` | Modify |
| `api/jest.config.js` | cấu hình ts-jest | Create |
| `api/prisma/schema.prisma` | sửa `UserSession`, thêm `RefreshToken` | Modify |
| `api/src/common/constants/error-codes.constant.ts` | thêm `AUTH_004/005/006` | Modify |
| `api/src/auth/auth.utils.ts` | hằng số TTL/cookie + `parsePlatformFromUserAgent` | Modify |
| `api/src/auth/token.service.ts` | thêm `verifyAccessToken`, `getRefreshTokenTtlMs` | Modify |
| `api/src/auth/session.service.ts` | vòng đời session/refresh token, reuse detection | Create |
| `api/src/auth/device.service.ts` | upsert device, activate device_user, list accounts | Create |
| `api/src/auth/auth.service.ts` | orchestrate exchange/refresh/switch/logout/list/revoke | Modify |
| `api/src/auth/dto/exchange-google-code.dto.ts` | thêm `deviceFingerprint`, `deviceName` | Modify |
| `api/src/auth/dto/switch-account.dto.ts` | DTO switch | Create |
| `api/src/common/guards/access-token.guard.ts` | verify JWT access token | Create |
| `api/src/auth/auth.controller.ts` | thêm route refresh/switch/logout/accounts/devices/sessions | Modify |
| `api/src/auth/auth.module.ts` | đăng ký providers mới | Modify |

**Shared type** (định nghĩa trong `session.service.ts`, import lại nơi khác):
```typescript
import { Prisma } from '../generated/prisma/client';
export type PrismaTx = Prisma.TransactionClient;
```

---

## Task 1: Test infrastructure

**Files:**
- Modify: `api/package.json`
- Create: `api/jest.config.js`
- Test: `api/src/sanity.spec.ts`

- [ ] **Step 1: Cài devDependencies**

Run:
```bash
cd api && npm i -D jest ts-jest @types/jest @nestjs/testing
```

- [ ] **Step 2: Tạo `api/jest.config.js`**

```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['**/*.(t|j)s'],
};
```

- [ ] **Step 3: Thêm script test vào `package.json`** (trong `"scripts"`)

```json
    "test": "jest",
    "test:watch": "jest --watch",
```

- [ ] **Step 4: Viết smoke test `api/src/sanity.spec.ts`**

```typescript
describe('sanity', () => {
  it('runs jest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Chạy test — kỳ vọng PASS**

Run: `cd api && npm test`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add api/package.json api/package-lock.json api/jest.config.js api/src/sanity.spec.ts
git commit -m "test: setup jest + ts-jest"
```

---

## Task 2: Schema — refactor UserSession + add RefreshToken

**Files:**
- Modify: `api/prisma/schema.prisma`

- [ ] **Step 1: Thay block `model UserSession` hiện tại bằng:**

```prisma
model UserSession {
  id             String         @id @default(uuid()) @db.Uuid
  user_id        String         @db.Uuid
  device_id      String         @db.Uuid
  is_revoked     Boolean        @default(false)
  revoked_at     DateTime?      @db.Timestamptz(6)
  revoke_reason  String?        @db.VarChar(100)
  last_used_at   DateTime?      @db.Timestamptz(6)
  expires_at     DateTime       @db.Timestamptz(6)
  created_at     DateTime       @default(now()) @db.Timestamptz(6)
  updated_at     DateTime       @updatedAt @db.Timestamptz(6)
  user           User           @relation(fields: [user_id], references: [id])
  device         Device         @relation(fields: [device_id], references: [id])
  refresh_tokens RefreshToken[]

  @@index([user_id, is_revoked])
  @@index([device_id, is_revoked])
  @@map("user_sessions")
}

model RefreshToken {
  id             String      @id @default(uuid()) @db.Uuid
  session_id     String      @db.Uuid
  token_hash     String      @unique
  expires_at     DateTime    @db.Timestamptz(6)
  used_at        DateTime?   @db.Timestamptz(6)
  is_revoked     Boolean     @default(false)
  replaced_by_id String?     @db.Uuid
  created_at     DateTime    @default(now()) @db.Timestamptz(6)
  session        UserSession @relation(fields: [session_id], references: [id])

  @@index([session_id])
  @@map("refresh_tokens")
}
```

- [ ] **Step 2: Validate + format schema**

Run: `cd api && npm run db:validate && npm run db:format`
Expected: "The schema is valid".

- [ ] **Step 3: Tạo migration + generate client**

Run: `cd api && npm run db:migrate:dev -- --name session_refresh_token && npm run db:generate`
Expected: migration mới trong `prisma/migrations/`, client generate thành công.

- [ ] **Step 4: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations
git commit -m "feat(db): refactor UserSession + add RefreshToken"
```

---

## Task 3: Error codes

**Files:**
- Modify: `api/src/common/constants/error-codes.constant.ts`

- [ ] **Step 1: Thêm 3 entry ngay sau block `AUTH_003`**

```typescript
  AUTH_004: {
    code: 'AUTH_004',
    message: 'Refresh token invalid',
  },
  AUTH_005: {
    code: 'AUTH_005',
    message: 'Session revoked due to suspicious activity',
  },
  AUTH_006: {
    code: 'AUTH_006',
    message: 'No active session for target account on this device',
  },
```

- [ ] **Step 2: Build kiểm tra type**

Run: `cd api && npm run build`
Expected: build pass.

- [ ] **Step 3: Commit**

```bash
git add api/src/common/constants/error-codes.constant.ts
git commit -m "feat(errors): add AUTH_004/005/006"
```

---

## Task 4: auth.utils — hằng số + parse platform

**Files:**
- Modify: `api/src/auth/auth.utils.ts`
- Test: `api/src/auth/auth.utils.spec.ts`

- [ ] **Step 1: Viết test `auth.utils.spec.ts`**

```typescript
import { parsePlatformFromUserAgent } from './auth.utils';

describe('parsePlatformFromUserAgent', () => {
  it('detects Windows', () => {
    expect(parsePlatformFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64)')).toBe('Windows');
  });
  it('detects Android', () => {
    expect(parsePlatformFromUserAgent('Mozilla/5.0 (Linux; Android 13)')).toBe('Android');
  });
  it('detects iOS', () => {
    expect(parsePlatformFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('iOS');
  });
  it('detects macOS', () => {
    expect(parsePlatformFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')).toBe('macOS');
  });
  it('returns null for undefined', () => {
    expect(parsePlatformFromUserAgent(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL** (`parsePlatformFromUserAgent` chưa tồn tại)

Run: `cd api && npx jest auth.utils -v`
Expected: FAIL "parsePlatformFromUserAgent is not a function".

- [ ] **Step 3: Thêm hằng số + hàm vào cuối `auth.utils.ts`**

Sửa hằng số cookie path (thêm constant) và thêm hàm. Thêm vào file:

```typescript
export const REFRESH_TOKEN_COOKIE_PATH = '/auth';

/**
 * Input: Chuỗi User-Agent từ request (có thể undefined).
 * Output: Tên platform để hiển thị (Windows/macOS/iOS/Android/Linux) hoặc null nếu không nhận diện được.
 */
export function parsePlatformFromUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) {
    return null;
  }
  const ua = userAgent.toLowerCase();
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  return null;
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `cd api && npx jest auth.utils -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add api/src/auth/auth.utils.ts api/src/auth/auth.utils.spec.ts
git commit -m "feat(auth): platform parser + refresh cookie path const"
```

---

## Task 5: TokenService — verifyAccessToken + TTL helper

**Files:**
- Modify: `api/src/auth/token.service.ts`
- Test: `api/src/auth/token.service.spec.ts`

- [ ] **Step 1: Viết test `token.service.spec.ts`**

```typescript
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { AppException } from '../common/exceptions/app.exception';

function makeService(): TokenService {
  const config = { get: (k: string) => (k === 'JWT_SECRET' ? 'test-secret-123' : undefined) } as unknown as ConfigService;
  return new TokenService(config);
}

describe('TokenService.verifyAccessToken', () => {
  it('verifies a token it created', () => {
    const svc = makeService();
    const token = svc.createAccessToken('user-1', 'a@b.com');
    const payload = svc.verifyAccessToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('a@b.com');
  });

  it('throws AppException on garbage token', () => {
    const svc = makeService();
    expect(() => svc.verifyAccessToken('not-a-jwt')).toThrow(AppException);
  });

  it('getRefreshTokenTtlMs returns 7 days in ms', () => {
    expect(makeService().getRefreshTokenTtlMs()).toBe(604800 * 1000);
  });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `cd api && npx jest token.service -v`
Expected: FAIL "verifyAccessToken is not a function".

- [ ] **Step 3: Sửa `token.service.ts`**

Đổi import dòng `import { sign } from 'jsonwebtoken';` thành:
```typescript
import { JwtPayload, sign, verify } from 'jsonwebtoken';
```

Thêm 2 method (trước `private getJwtSecret`):
```typescript
  /**
   * Input: JWT access token cần xác thực.
   * Output: Trả { sub, email } nếu hợp lệ; ném AppException AUTH_001 nếu sai/không hết hạn.
   */
  verifyAccessToken(token: string): { sub: string; email: string } {
    try {
      const payload = verify(token, this.getJwtSecret(), {
        algorithms: ['HS256'],
        issuer: TokenService.ACCESS_TOKEN_ISSUER,
        audience: TokenService.ACCESS_TOKEN_AUDIENCE,
      }) as JwtPayload;
      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      const email = typeof payload.email === 'string' ? payload.email : '';
      if (!sub || !email) {
        throw new AppException(ERROR_CODES.AUTH_001);
      }
      return { sub, email };
    } catch (err) {
      if (err instanceof AppException) throw err;
      throw new AppException(ERROR_CODES.AUTH_001);
    }
  }

  /**
   * Input: Không nhận tham số.
   * Output: Trả TTL refresh token theo mili-giây để dựng expires_at.
   */
  getRefreshTokenTtlMs(): number {
    return TokenService.REFRESH_TOKEN_TTL_SECONDS * 1000;
  }
```

Thêm import `AppException` nếu chưa có (kiểm tra đầu file — đã có `ERROR_CODES`; thêm):
```typescript
import { AppException } from '../common/exceptions/app.exception';
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `cd api && npx jest token.service -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add api/src/auth/token.service.ts api/src/auth/token.service.spec.ts
git commit -m "feat(auth): TokenService.verifyAccessToken + refresh TTL ms"
```

---

## Task 6: SessionService

**Files:**
- Create: `api/src/auth/session.service.ts`
- Test: `api/src/auth/session.service.spec.ts`

Public API:
- `createSession({ userId, deviceId }, tx)` → `{ sessionId, refreshTokenRaw }`
- `rotateByRawToken(rawToken, tx)` → `{ refreshTokenRaw, userId, email }`
- `validateActiveRawToken(rawToken, tx)` → `{ sessionId, userId, deviceId }`
- `issueFreshTokenForSession(session, tx)` → `refreshTokenRaw`
- `findActiveSession(userId, deviceId, tx)` → `session | null`
- `revokeByRawToken(rawToken, tx)` → `void`
- `revokeSessionOwnedByUser(sessionId, userId, tx)` → `void`
- `listByUser(userId)` → sessions (include device)

- [ ] **Step 1: Viết test `session.service.spec.ts`** (mock DatabaseService + TokenService)

```typescript
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { AppException } from '../common/exceptions/app.exception';

function makeTokenService(): jest.Mocked<Pick<TokenService, 'createRefreshToken' | 'hashToken' | 'getRefreshTokenTtlMs'>> {
  let n = 0;
  return {
    createRefreshToken: jest.fn(() => ({ raw: `raw-${++n}`, hash: `hash-of-raw-${n}` })),
    hashToken: jest.fn((raw: string) => `hash-of-${raw}`),
    getRefreshTokenTtlMs: jest.fn(() => 604800 * 1000),
  } as never;
}

function makeTx() {
  return {
    userSession: {
      create: jest.fn(async ({ data }) => ({ id: 'sess-1', ...data })),
      update: jest.fn(async ({ data }) => ({ id: 'sess-1', ...data })),
      findFirst: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(async ({ data }) => ({ id: 'rt-new', ...data })),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUnique: jest.fn(),
    },
  };
}

describe('SessionService', () => {
  it('createSession creates session + first refresh token', async () => {
    const token = makeTokenService();
    const svc = new SessionService({} as never, token as never);
    const tx = makeTx();
    const res = await svc.createSession({ userId: 'u1', deviceId: 'd1' }, tx as never);
    expect(tx.userSession.create).toHaveBeenCalled();
    expect(tx.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ session_id: 'sess-1', token_hash: 'hash-of-raw-1' }) }),
    );
    expect(res).toEqual({ sessionId: 'sess-1', refreshTokenRaw: 'raw-1' });
  });

  it('rotateByRawToken rotates an active token', async () => {
    const token = makeTokenService();
    const svc = new SessionService({} as never, token as never);
    const tx = makeTx();
    tx.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1', token_hash: 'hash-of-raw-x', used_at: null, is_revoked: false,
      session: { id: 'sess-1', user_id: 'u1', is_revoked: false, expires_at: new Date(Date.now() + 1e6), user: { email: 'a@b.com' } },
    });
    const res = await svc.rotateByRawToken('raw-x', tx as never);
    expect(tx.refreshToken.create).toHaveBeenCalled();
    expect(tx.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-1' }, data: expect.objectContaining({ replaced_by_id: 'rt-new' }) }),
    );
    expect(res).toEqual({ refreshTokenRaw: 'raw-1', userId: 'u1', email: 'a@b.com' });
  });

  it('rotateByRawToken throws AUTH_004 when token not found', async () => {
    const svc = new SessionService({} as never, makeTokenService() as never);
    const tx = makeTx();
    tx.refreshToken.findUnique.mockResolvedValue(null);
    await expect(svc.rotateByRawToken('nope', tx as never)).rejects.toThrow(AppException);
  });

  it('rotateByRawToken detects reuse and revokes the whole session', async () => {
    const svc = new SessionService({} as never, makeTokenService() as never);
    const tx = makeTx();
    tx.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-old', used_at: new Date(), is_revoked: false,
      session: { id: 'sess-1', user_id: 'u1', is_revoked: false, expires_at: new Date(Date.now() + 1e6), user: { email: 'a@b.com' } },
    });
    await expect(svc.rotateByRawToken('raw-reused', tx as never)).rejects.toThrow(AppException);
    expect(tx.userSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sess-1' }, data: expect.objectContaining({ is_revoked: true, revoke_reason: 'reuse_detected' }) }),
    );
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { session_id: 'sess-1', is_revoked: false } }),
    );
  });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL** (module chưa tồn tại)

Run: `cd api && npx jest session.service -v`
Expected: FAIL "Cannot find module './session.service'".

- [ ] **Step 3: Tạo `session.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
import { TokenService } from './token.service';

export type PrismaTx = Prisma.TransactionClient;

type ActiveSessionInfo = { sessionId: string; userId: string; deviceId: string };

@Injectable()
export class SessionService {
  /**
   * Input: DatabaseService cho query ngoài transaction, TokenService để tạo/băm refresh token.
   * Output: Service quản lý vòng đời UserSession + RefreshToken.
   */
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Input: userId, deviceId và transaction client.
   * Output: Tạo session mới + refresh token đầu tiên; trả { sessionId, refreshTokenRaw }.
   */
  async createSession(params: { userId: string; deviceId: string }, tx: PrismaTx) {
    const expiresAt = new Date(Date.now() + this.tokenService.getRefreshTokenTtlMs());
    const session = await tx.userSession.create({
      data: { user_id: params.userId, device_id: params.deviceId, expires_at: expiresAt },
    });
    const { raw, hash } = this.tokenService.createRefreshToken();
    await tx.refreshToken.create({
      data: { session_id: session.id, token_hash: hash, expires_at: expiresAt },
    });
    return { sessionId: session.id, refreshTokenRaw: raw };
  }

  /**
   * Input: refresh token raw từ cookie và transaction client.
   * Output: Rotate token (cấp mới, retire token cũ); trả { refreshTokenRaw, userId, email }.
   *         Phát hiện reuse/expired → revoke cả session và ném AUTH_005; không tìm thấy → AUTH_004.
   */
  async rotateByRawToken(rawToken: string, tx: PrismaTx) {
    const existing = await this.findValidTokenOrFail(rawToken, tx);
    const session = existing.session;
    const { raw, hash } = this.tokenService.createRefreshToken();
    const created = await tx.refreshToken.create({
      data: { session_id: session.id, token_hash: hash, expires_at: session.expires_at },
    });
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { used_at: new Date(), replaced_by_id: created.id },
    });
    await tx.userSession.update({ where: { id: session.id }, data: { last_used_at: new Date() } });
    return { refreshTokenRaw: raw, userId: session.user_id, email: session.user.email };
  }

  /**
   * Input: refresh token raw active và transaction client.
   * Output: Xác thực token còn hiệu lực (reuse detection như rotate, KHÔNG mutate); trả ids của session.
   */
  async validateActiveRawToken(rawToken: string, tx: PrismaTx): Promise<ActiveSessionInfo> {
    const existing = await this.findValidTokenOrFail(rawToken, tx);
    return { sessionId: existing.session.id, userId: existing.session.user_id, deviceId: existing.session.device_id };
  }

  /**
   * Input: session (id + expires_at) và transaction client.
   * Output: Retire mọi refresh token active của session rồi cấp 1 token mới; trả raw. Dùng cho switch.
   */
  async issueFreshTokenForSession(session: { id: string; expires_at: Date }, tx: PrismaTx) {
    await tx.refreshToken.updateMany({
      where: { session_id: session.id, used_at: null, is_revoked: false },
      data: { used_at: new Date() },
    });
    const { raw, hash } = this.tokenService.createRefreshToken();
    await tx.refreshToken.create({
      data: { session_id: session.id, token_hash: hash, expires_at: session.expires_at },
    });
    await tx.userSession.update({ where: { id: session.id }, data: { last_used_at: new Date() } });
    return raw;
  }

  /**
   * Input: userId, deviceId và transaction client.
   * Output: Session còn sống (chưa revoke, chưa hết hạn) mới nhất cho cặp user+device, hoặc null.
   */
  async findActiveSession(userId: string, deviceId: string, tx: PrismaTx) {
    return tx.userSession.findFirst({
      where: { user_id: userId, device_id: deviceId, is_revoked: false, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Input: refresh token raw và transaction client.
   * Output: Revoke session sở hữu token (reason 'logout') + mọi refresh token của nó. Bỏ qua nếu token không khớp.
   */
  async revokeByRawToken(rawToken: string, tx: PrismaTx): Promise<void> {
    const hash = this.tokenService.hashToken(rawToken);
    const token = await tx.refreshToken.findUnique({ where: { token_hash: hash }, include: { session: true } });
    if (!token) return;
    await this.revokeSession(token.session.id, 'logout', tx);
  }

  /**
   * Input: sessionId, userId chủ sở hữu và transaction client.
   * Output: Revoke session (reason 'revoked_remote') nếu thuộc về user; ném AUTH_001 nếu không sở hữu.
   */
  async revokeSessionOwnedByUser(sessionId: string, userId: string, tx: PrismaTx): Promise<void> {
    const session = await tx.userSession.findFirst({ where: { id: sessionId, user_id: userId } });
    if (!session) throw new AppException(ERROR_CODES.AUTH_001);
    await this.revokeSession(sessionId, 'revoked_remote', tx);
  }

  /**
   * Input: userId.
   * Output: Danh sách session chưa revoke kèm device để hiển thị "thiết bị đang đăng nhập".
   */
  async listByUser(userId: string) {
    return this.databaseService.userSession.findMany({
      where: { user_id: userId, is_revoked: false },
      include: { device: true },
      orderBy: { last_used_at: 'desc' },
    });
  }

  /**
   * Input: rawToken, tx.
   * Output: RefreshToken active (kèm session+user). Reuse/expired → revoke session + AUTH_005; không thấy → AUTH_004.
   */
  private async findValidTokenOrFail(rawToken: string, tx: PrismaTx) {
    const hash = this.tokenService.hashToken(rawToken);
    const existing = await tx.refreshToken.findUnique({
      where: { token_hash: hash },
      include: { session: { include: { user: true } } },
    });
    if (!existing) {
      throw new AppException(ERROR_CODES.AUTH_004);
    }
    const session = existing.session;
    const expired = session.expires_at.getTime() <= Date.now();
    if (existing.used_at || existing.is_revoked || session.is_revoked || expired) {
      await this.revokeSession(session.id, 'reuse_detected', tx);
      throw new AppException(ERROR_CODES.AUTH_005);
    }
    return existing;
  }

  /**
   * Input: sessionId, lý do revoke, tx.
   * Output: Đánh dấu session revoked + revoke mọi refresh token chưa revoke của session.
   */
  private async revokeSession(sessionId: string, reason: string, tx: PrismaTx): Promise<void> {
    await tx.userSession.update({
      where: { id: sessionId },
      data: { is_revoked: true, revoked_at: new Date(), revoke_reason: reason },
    });
    await tx.refreshToken.updateMany({
      where: { session_id: sessionId, is_revoked: false },
      data: { is_revoked: true },
    });
  }
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `cd api && npx jest session.service -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add api/src/auth/session.service.ts api/src/auth/session.service.spec.ts
git commit -m "feat(auth): SessionService with rotation + reuse detection"
```

---

## Task 7: DeviceService

**Files:**
- Create: `api/src/auth/device.service.ts`
- Test: `api/src/auth/device.service.spec.ts`

Public API:
- `upsertDevice({ fingerprint, deviceName, userAgent }, tx)` → device
- `activateDeviceUser({ deviceId, userId }, tx)` → void (đảm bảo chỉ 1 active/máy)
- `listAccountsByDevice(deviceId)` → device_users (include user)

- [ ] **Step 1: Viết test `device.service.spec.ts`**

```typescript
import { DeviceService } from './device.service';

function makeTx() {
  return {
    device: { upsert: jest.fn(async ({ create }) => ({ id: 'dev-1', ...create })) },
    deviceUser: {
      updateMany: jest.fn(async () => ({ count: 1 })),
      upsert: jest.fn(async () => ({ id: 'du-1' })),
    },
  };
}

describe('DeviceService', () => {
  it('upsertDevice parses platform from user-agent', async () => {
    const svc = new DeviceService({} as never);
    const tx = makeTx();
    await svc.upsertDevice({ fingerprint: 'fp1', deviceName: 'My PC', userAgent: 'Windows NT 10.0' }, tx as never);
    expect(tx.device.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { device_fingerprint: 'fp1' },
        create: expect.objectContaining({ device_fingerprint: 'fp1', platform: 'Windows', device_name: 'My PC' }),
      }),
    );
  });

  it('activateDeviceUser deactivates others before activating target', async () => {
    const svc = new DeviceService({} as never);
    const tx = makeTx();
    await svc.activateDeviceUser({ deviceId: 'dev-1', userId: 'u1' }, tx as never);
    expect(tx.deviceUser.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { device_id: 'dev-1', is_active: true }, data: { is_active: false } }),
    );
    expect(tx.deviceUser.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { device_id_user_id: { device_id: 'dev-1', user_id: 'u1' } },
        update: { is_active: true },
      }),
    );
  });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `cd api && npx jest device.service -v`
Expected: FAIL "Cannot find module './device.service'".

- [ ] **Step 3: Tạo `device.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { parsePlatformFromUserAgent } from './auth.utils';
import { PrismaTx } from './session.service';

@Injectable()
export class DeviceService {
  /**
   * Input: DatabaseService cho query đọc ngoài transaction.
   * Output: Service quản lý Device + DeviceUser.
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: fingerprint (bắt buộc), deviceName (tùy chọn), userAgent (tùy chọn) và transaction client.
   * Output: Upsert Device theo fingerprint; cập nhật platform/last_seen_at; trả device.
   */
  async upsertDevice(
    params: { fingerprint: string; deviceName?: string | null; userAgent?: string },
    tx: PrismaTx,
  ) {
    const platform = parsePlatformFromUserAgent(params.userAgent);
    const now = new Date();
    return tx.device.upsert({
      where: { device_fingerprint: params.fingerprint },
      create: {
        device_fingerprint: params.fingerprint,
        device_name: params.deviceName ?? null,
        platform,
        last_seen_at: now,
      },
      update: {
        ...(params.deviceName ? { device_name: params.deviceName } : {}),
        ...(platform ? { platform } : {}),
        last_seen_at: now,
      },
    });
  }

  /**
   * Input: deviceId, userId và transaction client.
   * Output: Set is_active=false cho mọi account khác cùng device, rồi upsert+activate account này (chỉ 1 active/máy).
   */
  async activateDeviceUser(params: { deviceId: string; userId: string }, tx: PrismaTx): Promise<void> {
    await tx.deviceUser.updateMany({
      where: { device_id: params.deviceId, is_active: true },
      data: { is_active: false },
    });
    await tx.deviceUser.upsert({
      where: { device_id_user_id: { device_id: params.deviceId, user_id: params.userId } },
      create: { device_id: params.deviceId, user_id: params.userId, is_active: true },
      update: { is_active: true },
    });
  }

  /**
   * Input: deviceId.
   * Output: Danh sách account đã link với device (kèm user) để dựng UI account switcher.
   */
  async listAccountsByDevice(deviceId: string) {
    return this.databaseService.deviceUser.findMany({
      where: { device_id: deviceId },
      include: { user: true },
      orderBy: { linked_at: 'desc' },
    });
  }
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `cd api && npx jest device.service -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add api/src/auth/device.service.ts api/src/auth/device.service.spec.ts
git commit -m "feat(auth): DeviceService upsert + activate device_user"
```

---

## Task 8: DTOs — exchange (extend) + switch

**Files:**
- Modify: `api/src/auth/dto/exchange-google-code.dto.ts`
- Create: `api/src/auth/dto/switch-account.dto.ts`

- [ ] **Step 1: Sửa `exchange-google-code.dto.ts`**

```typescript
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ExchangeGoogleCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  deviceFingerprint!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceName?: string;
}
```

- [ ] **Step 2: Tạo `switch-account.dto.ts`**

```typescript
import { IsNotEmpty, IsUUID } from 'class-validator';

export class SwitchAccountDto {
  @IsUUID()
  @IsNotEmpty()
  targetUserId!: string;
}
```

- [ ] **Step 3: Build kiểm tra**

Run: `cd api && npm run build`
Expected: build pass.

- [ ] **Step 4: Commit**

```bash
git add api/src/auth/dto
git commit -m "feat(auth): exchange dto fields + switch dto"
```

---

## Task 9: AccessTokenGuard

**Files:**
- Create: `api/src/common/guards/access-token.guard.ts`
- Test: `api/src/common/guards/access-token.guard.spec.ts`

Guard đọc `Authorization: Bearer <token>`, verify bằng `TokenService`, gán `request.userId`/`request.userEmail`.

- [ ] **Step 1: Viết test `access-token.guard.spec.ts`**

```typescript
import { ExecutionContext } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard';
import { TokenService } from '../../auth/token.service';
import { AppException } from '../exceptions/app.exception';

function ctxWithAuth(header?: string): ExecutionContext {
  const req: Record<string, unknown> = { headers: header ? { authorization: header } : {} };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('AccessTokenGuard', () => {
  it('allows a valid bearer token and sets userId', () => {
    const token = { verifyAccessToken: jest.fn(() => ({ sub: 'u1', email: 'a@b.com' })) } as unknown as TokenService;
    const guard = new AccessTokenGuard(token);
    const ctx = ctxWithAuth('Bearer good-token');
    expect(guard.canActivate(ctx)).toBe(true);
    const req = ctx.switchToHttp().getRequest() as Record<string, unknown>;
    expect(req.userId).toBe('u1');
  });

  it('throws AUTH_001 when header missing', () => {
    const token = { verifyAccessToken: jest.fn() } as unknown as TokenService;
    const guard = new AccessTokenGuard(token);
    expect(() => guard.canActivate(ctxWithAuth())).toThrow(AppException);
  });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `cd api && npx jest access-token.guard -v`
Expected: FAIL "Cannot find module './access-token.guard'".

- [ ] **Step 3: Tạo `access-token.guard.ts`**

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';
import { TokenService } from '../../auth/token.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  /**
   * Input: TokenService để verify JWT access token.
   * Output: Guard chặn request thiếu/không hợp lệ access token.
   */
  constructor(private readonly tokenService: TokenService) {}

  /**
   * Input: ExecutionContext của request HTTP.
   * Output: true nếu Bearer token hợp lệ (gán req.userId/req.userEmail); ném AUTH_001 nếu không.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; userEmail?: string }>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppException(ERROR_CODES.AUTH_001);
    }
    const token = header.slice('Bearer '.length).trim();
    const payload = this.tokenService.verifyAccessToken(token);
    request.userId = payload.sub;
    request.userEmail = payload.email;
    return true;
  }
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `cd api && npx jest access-token.guard -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add api/src/common/guards/access-token.guard.ts api/src/common/guards/access-token.guard.spec.ts
git commit -m "feat(auth): AccessTokenGuard"
```

---

## Task 10: AuthService — orchestrate (exchange/refresh/switch/logout/list/revoke)

**Files:**
- Modify: `api/src/auth/auth.service.ts`
- Test: `api/src/auth/auth.service.spec.ts`

Phương thức công khai mới/đổi:
- `exchangeGoogleLoginCode(code, changeToken, ctx: { deviceFingerprint, deviceName?, userAgent? })` → `{ accessToken, accessTokenExpiresAt, refreshToken, user }`
- `refresh(rawToken)` → `{ accessToken, accessTokenExpiresAt, refreshToken }`
- `switchAccount(rawToken, targetUserId)` → `{ accessToken, accessTokenExpiresAt, refreshToken, user }`
- `logout(rawToken)` → `void`
- `listAccounts(rawToken)` → `{ accounts: [...] }`
- `listDevices(userId)` → `{ devices: [...] }`
- `revokeSession(sessionId, userId)` → `void`

> `loginWithGoogle` (tạo code + changeToken) **giữ nguyên**. Bỏ toàn bộ `cacheManager` cho refresh hash; vẫn dùng cache cho login code.

- [ ] **Step 1: Viết test `auth.service.spec.ts`** (mock DatabaseService + SessionService + DeviceService + TokenService + Cache)

```typescript
import { AuthService } from './auth.service';

function makeDeps() {
  const tx = {};
  const databaseService = {
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    user: { findUnique: jest.fn() },
    deviceUser: { findUnique: jest.fn() },
  };
  const cacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const tokenService = {
    hashToken: jest.fn((s: string) => `hash-of-${s}`),
    safeCompareHash: jest.fn(() => true),
    createAccessToken: jest.fn(() => 'access-jwt'),
    getAccessTokenTtlSeconds: jest.fn(() => 3600),
  };
  const sessionService = {
    createSession: jest.fn(async () => ({ sessionId: 'sess-1', refreshTokenRaw: 'refresh-raw' })),
    rotateByRawToken: jest.fn(async () => ({ refreshTokenRaw: 'rot-raw', userId: 'u1', email: 'a@b.com' })),
    validateActiveRawToken: jest.fn(async () => ({ sessionId: 'sess-1', userId: 'u1', deviceId: 'd1' })),
    issueFreshTokenForSession: jest.fn(async () => 'target-raw'),
    findActiveSession: jest.fn(async () => ({ id: 'sess-2', expires_at: new Date(Date.now() + 1e6) })),
    revokeByRawToken: jest.fn(async () => undefined),
  };
  const deviceService = {
    upsertDevice: jest.fn(async () => ({ id: 'd1' })),
    activateDeviceUser: jest.fn(async () => undefined),
  };
  return { databaseService, cacheManager, tokenService, sessionService, deviceService, tx };
}

function makeService(d: ReturnType<typeof makeDeps>): AuthService {
  return new AuthService(
    d.databaseService as never,
    d.cacheManager as never,
    d.tokenService as never,
    d.sessionService as never,
    d.deviceService as never,
  );
}

describe('AuthService.exchangeGoogleLoginCode', () => {
  it('persists device + session and returns tokens', async () => {
    const d = makeDeps();
    d.cacheManager.get.mockResolvedValue(JSON.stringify({ email: 'a@b.com', changeTokenHash: 'hash-of-change' }));
    d.databaseService.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', provider_user_id: 'g1', email_verified: true, full_name: 'A', avatar_url: null });
    const svc = makeService(d);
    const res = await svc.exchangeGoogleLoginCode('code1', 'change', { deviceFingerprint: 'fp', userAgent: 'Windows' });
    expect(d.deviceService.upsertDevice).toHaveBeenCalled();
    expect(d.deviceService.activateDeviceUser).toHaveBeenCalledWith({ deviceId: 'd1', userId: 'u1' }, d.tx);
    expect(d.sessionService.createSession).toHaveBeenCalledWith({ userId: 'u1', deviceId: 'd1' }, d.tx);
    expect(res.refreshToken).toBe('refresh-raw');
    expect(res.accessToken).toBe('access-jwt');
  });
});

describe('AuthService.switchAccount', () => {
  it('switches when target linked and has active session', async () => {
    const d = makeDeps();
    d.databaseService.deviceUser.findUnique.mockResolvedValue({ id: 'du-2' });
    d.databaseService.user.findUnique.mockResolvedValue({ id: 'u2', email: 'b@c.com', provider_user_id: 'g2', email_verified: true, full_name: 'B', avatar_url: null });
    const svc = makeService(d);
    const res = await svc.switchAccount('refresh-raw', 'u2');
    expect(d.sessionService.issueFreshTokenForSession).toHaveBeenCalled();
    expect(d.deviceService.activateDeviceUser).toHaveBeenCalledWith({ deviceId: 'd1', userId: 'u2' }, d.tx);
    expect(res.refreshToken).toBe('target-raw');
    expect(res.user.email).toBe('b@c.com');
  });

  it('throws AUTH_006 when target not linked', async () => {
    const d = makeDeps();
    d.databaseService.deviceUser.findUnique.mockResolvedValue(null);
    const svc = makeService(d);
    await expect(svc.switchAccount('refresh-raw', 'u2')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL** (constructor signature & methods mới)

Run: `cd api && npx jest auth.service -v`
Expected: FAIL.

- [ ] **Step 3: Viết lại `auth.service.ts`**

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleUser } from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { DeviceService } from './device.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

type GoogleLoginCallbackArtifacts = { code: string; changeToken: string };
type GoogleLoginCodeCacheValue = { email: string; changeTokenHash: string };
type ExchangeContext = { deviceFingerprint: string; deviceName?: string; userAgent?: string };
type AuthTokens = { accessToken: string; accessTokenExpiresAt: string; refreshToken: string; user: GoogleUser };

@Injectable()
export class AuthService {
  private static readonly CACHE_AUTH_CODE_PREFIX = 'auth:google:code:';

  /**
   * Input: DatabaseService, Cache (login code), TokenService, SessionService, DeviceService.
   * Output: Service orchestrate toàn bộ nghiệp vụ đăng nhập/refresh/switch/logout.
   */
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly deviceService: DeviceService,
  ) {}

  /**
   * Input: Profile Google đã chuẩn hóa.
   * Output: Upsert user + trả { code, changeToken } cho callback FE (giữ nguyên hành vi cũ).
   */
  async loginWithGoogle(googleUser: GoogleUser): Promise<GoogleLoginCallbackArtifacts> {
    const user = await this.upsertGoogleUser(googleUser);
    const normalizedEmail = user.email.trim().toLowerCase();
    const code = this.tokenService.createGoogleLoginCode();
    const { raw: changeTokenRaw, hash: changeTokenHash } = this.tokenService.createGoogleChangeToken();
    const cacheValue: GoogleLoginCodeCacheValue = { email: normalizedEmail, changeTokenHash };
    await this.cacheManager.set(
      this.getAuthCodeCacheKey(code),
      JSON.stringify(cacheValue),
      this.tokenService.getGoogleChangeTokenTtlSeconds() * 1000,
    );
    return { code, changeToken: changeTokenRaw };
  }

  /**
   * Input: code callback, change token raw từ cookie, ngữ cảnh thiết bị.
   * Output: Persist Device/DeviceUser/UserSession/RefreshToken trong transaction; trả access + refresh + user.
   */
  async exchangeGoogleLoginCode(code: string, changeToken: string, ctx: ExchangeContext): Promise<AuthTokens> {
    const normalizedCode = code.trim();
    if (!normalizedCode) throw new AppException(ERROR_CODES.AUTH_003);

    const cacheKey = this.getAuthCodeCacheKey(normalizedCode);
    const rawCache = await this.cacheManager.get<string>(cacheKey);
    if (!rawCache) throw new AppException(ERROR_CODES.AUTH_003);

    const cachedValue = this.parseGoogleLoginCodeCacheValue(rawCache);
    if (!cachedValue) throw new AppException(ERROR_CODES.AUTH_003);

    const incomingHash = this.tokenService.hashToken(changeToken);
    if (!this.tokenService.safeCompareHash(incomingHash, cachedValue.changeTokenHash)) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }
    await this.cacheManager.del(cacheKey);

    const user = await this.databaseService.user.findUnique({ where: { email: cachedValue.email } });
    if (!user) throw new AppException(ERROR_CODES.AUTH_003);

    const refreshTokenRaw = await this.databaseService.$transaction(async (tx) => {
      const device = await this.deviceService.upsertDevice(
        { fingerprint: ctx.deviceFingerprint, deviceName: ctx.deviceName, userAgent: ctx.userAgent },
        tx,
      );
      await this.deviceService.activateDeviceUser({ deviceId: device.id, userId: user.id }, tx);
      const session = await this.sessionService.createSession({ userId: user.id, deviceId: device.id }, tx);
      return session.refreshTokenRaw;
    });

    return this.buildAuthTokens(user.id, cachedValue.email, refreshTokenRaw, this.toGoogleUser(user));
  }

  /**
   * Input: refresh token raw từ cookie.
   * Output: Rotate token + trả access token mới (reuse detection do SessionService đảm nhiệm).
   */
  async refresh(rawToken: string): Promise<{ accessToken: string; accessTokenExpiresAt: string; refreshToken: string }> {
    const rotated = await this.databaseService.$transaction((tx) => this.sessionService.rotateByRawToken(rawToken, tx));
    const accessToken = this.tokenService.createAccessToken(rotated.userId, rotated.email);
    return { accessToken, accessTokenExpiresAt: this.accessExpiry(), refreshToken: rotated.refreshTokenRaw };
  }

  /**
   * Input: refresh token raw active (account hiện tại) + targetUserId.
   * Output: Switch sang account đích trên cùng device; trả access + refresh + user đích.
   */
  async switchAccount(rawToken: string, targetUserId: string): Promise<AuthTokens> {
    const result = await this.databaseService.$transaction(async (tx) => {
      const active = await this.sessionService.validateActiveRawToken(rawToken, tx);
      const link = await this.databaseService.deviceUser.findUnique({
        where: { device_id_user_id: { device_id: active.deviceId, user_id: targetUserId } },
      });
      if (!link) throw new AppException(ERROR_CODES.AUTH_006);

      const targetSession = await this.sessionService.findActiveSession(targetUserId, active.deviceId, tx);
      if (!targetSession) throw new AppException(ERROR_CODES.AUTH_006);

      const refreshTokenRaw = await this.sessionService.issueFreshTokenForSession(targetSession, tx);
      await this.deviceService.activateDeviceUser({ deviceId: active.deviceId, userId: targetUserId }, tx);
      const user = await this.databaseService.user.findUnique({ where: { id: targetUserId } });
      if (!user) throw new AppException(ERROR_CODES.AUTH_006);
      return { refreshTokenRaw, user };
    });

    return this.buildAuthTokens(result.user.id, result.user.email, result.refreshTokenRaw, this.toGoogleUser(result.user));
  }

  /**
   * Input: refresh token raw.
   * Output: Revoke session hiện tại (logout). Không ném lỗi nếu token đã không hợp lệ.
   */
  async logout(rawToken: string): Promise<void> {
    await this.databaseService.$transaction((tx) => this.sessionService.revokeByRawToken(rawToken, tx));
  }

  /**
   * Input: refresh token raw active.
   * Output: Danh sách account đã link với device hiện tại (cho UI account switcher).
   */
  async listAccounts(rawToken: string) {
    const active = await this.databaseService.$transaction((tx) => this.sessionService.validateActiveRawToken(rawToken, tx));
    const links = await this.deviceService.listAccountsByDevice(active.deviceId);
    return {
      accounts: links.map((l) => ({
        userId: l.user.id,
        email: l.user.email,
        fullName: l.user.full_name,
        avatarUrl: l.user.avatar_url,
        isActive: l.is_active,
      })),
    };
  }

  /**
   * Input: userId từ access token guard.
   * Output: Danh sách thiết bị + session của user.
   */
  async listDevices(userId: string) {
    const sessions = await this.sessionService.listByUser(userId);
    return {
      devices: sessions.map((s) => ({
        sessionId: s.id,
        deviceId: s.device_id,
        deviceName: s.device.device_name,
        platform: s.device.platform,
        lastSeenAt: s.device.last_seen_at,
        createdAt: s.created_at,
      })),
    };
  }

  /**
   * Input: sessionId cần revoke + userId chủ sở hữu.
   * Output: Revoke session từ xa nếu thuộc về user.
   */
  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.databaseService.$transaction((tx) => this.sessionService.revokeSessionOwnedByUser(sessionId, userId, tx));
  }

  /**
   * Input: userId, email, refresh raw, googleUser.
   * Output: Đóng gói access token + expiry + refresh + user.
   */
  private buildAuthTokens(userId: string, email: string, refreshToken: string, user: GoogleUser): AuthTokens {
    const accessToken = this.tokenService.createAccessToken(userId, email);
    return { accessToken, accessTokenExpiresAt: this.accessExpiry(), refreshToken, user };
  }

  private accessExpiry(): string {
    return new Date(Date.now() + this.tokenService.getAccessTokenTtlSeconds() * 1000).toISOString();
  }

  private toGoogleUser(user: {
    provider_user_id: string;
    email: string;
    email_verified: boolean;
    full_name: string | null;
    avatar_url: string | null;
  }): GoogleUser {
    return {
      provider: 'google',
      providerUserId: user.provider_user_id,
      email: user.email,
      emailVerified: user.email_verified,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
    };
  }

  /**
   * Input: Dữ liệu Google user đã validate.
   * Output: Upsert bản ghi users theo provider_user_id và trả user mới nhất.
   */
  private async upsertGoogleUser(googleUser: GoogleUser) {
    const now = new Date();
    return this.databaseService.user.upsert({
      where: { provider_user_id: googleUser.providerUserId },
      update: {
        provider: googleUser.provider,
        email: googleUser.email,
        email_verified: googleUser.emailVerified,
        full_name: googleUser.fullName,
        avatar_url: googleUser.avatarUrl,
        status: 'active',
        last_login_at: now,
        is_deleted: false,
        deleted_by: null,
        deleted_at: null,
      },
      create: {
        provider: googleUser.provider,
        provider_user_id: googleUser.providerUserId,
        email: googleUser.email,
        email_verified: googleUser.emailVerified,
        full_name: googleUser.fullName,
        avatar_url: googleUser.avatarUrl,
        status: 'active',
        last_login_at: now,
      },
    });
  }

  private getAuthCodeCacheKey(code: string): string {
    return `${AuthService.CACHE_AUTH_CODE_PREFIX}${code}`;
  }

  private parseGoogleLoginCodeCacheValue(rawCache: string): GoogleLoginCodeCacheValue | null {
    try {
      const parsed = JSON.parse(rawCache) as Partial<GoogleLoginCodeCacheValue>;
      if (typeof parsed.email !== 'string' || typeof parsed.changeTokenHash !== 'string') return null;
      const email = parsed.email.trim().toLowerCase();
      const changeTokenHash = parsed.changeTokenHash.trim().toLowerCase();
      if (!email || !changeTokenHash) return null;
      return { email, changeTokenHash };
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `cd api && npx jest auth.service -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add api/src/auth/auth.service.ts api/src/auth/auth.service.spec.ts
git commit -m "feat(auth): orchestrate exchange/refresh/switch/logout/list/revoke"
```

---

## Task 11: AuthController — endpoints + cookies

**Files:**
- Modify: `api/src/auth/auth.controller.ts`

- [ ] **Step 1: Cập nhật imports + cookie path**

Đổi import từ `auth.utils` thêm `REFRESH_TOKEN_COOKIE_PATH`, và thêm guard + dto:
```typescript
import { Body, Controller, Delete, Get, Logger, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { SwitchAccountDto } from './dto/switch-account.dto';
import { REFRESH_TOKEN_COOKIE_PATH } from './auth.utils';
```
(giữ các import hiện có; `REFRESH_TOKEN_TTL_MS`, `REFRESH_TOKEN_COOKIE_NAME`, `readCookieValue`, ... vẫn dùng).

- [ ] **Step 2: Sửa `googleCallback`** — cookie change token giữ nguyên. Sửa `exchangeGoogleCode` để truyền ctx thiết bị và set cookie refresh path `/auth`:

```typescript
  @Post('google/exchange')
  async exchangeGoogleCode(
    @Body() body: ExchangeGoogleCodeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const changeToken = readCookieValue(request.headers.cookie, GOOGLE_CHANGE_TOKEN_COOKIE_NAME);
    if (!changeToken) {
      throw new AppException(ERROR_CODES.AUTH_003);
    }
    try {
      const result = await this.authService.exchangeGoogleLoginCode(body.code, changeToken, {
        deviceFingerprint: body.deviceFingerprint,
        deviceName: body.deviceName,
        userAgent: request.headers['user-agent'],
      });
      response.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        result.refreshToken,
        this.buildCookieOptions(REFRESH_TOKEN_COOKIE_PATH, REFRESH_TOKEN_TTL_MS),
      );
      return { accessToken: result.accessToken, accessTokenExpiresAt: result.accessTokenExpiresAt, user: result.user };
    } finally {
      response.clearCookie(
        GOOGLE_CHANGE_TOKEN_COOKIE_NAME,
        this.buildCookieOptions('/auth/google/exchange', GOOGLE_CALLBACK_EXCHANGE_TTL_MS),
      );
    }
  }
```

- [ ] **Step 3: Thêm các endpoint mới** (trước `private buildCookieOptions`)

```typescript
  /**
   * Input: cookie refresh_token.
   * Output: Access token mới + rotate refresh cookie.
   */
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = readCookieValue(request.headers.cookie, REFRESH_TOKEN_COOKIE_NAME);
    if (!rawToken) throw new AppException(ERROR_CODES.AUTH_001);
    const result = await this.authService.refresh(rawToken);
    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      result.refreshToken,
      this.buildCookieOptions(REFRESH_TOKEN_COOKIE_PATH, REFRESH_TOKEN_TTL_MS),
    );
    return { accessToken: result.accessToken, accessTokenExpiresAt: result.accessTokenExpiresAt };
  }

  /**
   * Input: cookie refresh_token + targetUserId.
   * Output: Chuyển account; access token + refresh cookie của account đích.
   */
  @Post('switch')
  async switchAccount(
    @Body() body: SwitchAccountDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const rawToken = readCookieValue(request.headers.cookie, REFRESH_TOKEN_COOKIE_NAME);
    if (!rawToken) throw new AppException(ERROR_CODES.AUTH_001);
    const result = await this.authService.switchAccount(rawToken, body.targetUserId);
    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      result.refreshToken,
      this.buildCookieOptions(REFRESH_TOKEN_COOKIE_PATH, REFRESH_TOKEN_TTL_MS),
    );
    return { accessToken: result.accessToken, accessTokenExpiresAt: result.accessTokenExpiresAt, user: result.user };
  }

  /**
   * Input: cookie refresh_token.
   * Output: Revoke session hiện tại + xóa cookie.
   */
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = readCookieValue(request.headers.cookie, REFRESH_TOKEN_COOKIE_NAME);
    if (rawToken) await this.authService.logout(rawToken);
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, this.buildCookieOptions(REFRESH_TOKEN_COOKIE_PATH, REFRESH_TOKEN_TTL_MS));
    return { success: true };
  }

  /**
   * Input: cookie refresh_token.
   * Output: Danh sách account đã link với device hiện tại.
   */
  @Get('accounts')
  async accounts(@Req() request: Request) {
    const rawToken = readCookieValue(request.headers.cookie, REFRESH_TOKEN_COOKIE_NAME);
    if (!rawToken) throw new AppException(ERROR_CODES.AUTH_001);
    return this.authService.listAccounts(rawToken);
  }

  /**
   * Input: access token (Bearer).
   * Output: Danh sách thiết bị/phiên của user.
   */
  @Get('devices')
  @UseGuards(AccessTokenGuard)
  async devices(@Req() request: Request & { userId: string }) {
    return this.authService.listDevices(request.userId);
  }

  /**
   * Input: access token (Bearer) + sessionId.
   * Output: Revoke session từ xa nếu thuộc về user.
   */
  @Delete('sessions/:id')
  @UseGuards(AccessTokenGuard)
  async revokeSession(@Param('id') id: string, @Req() request: Request & { userId: string }) {
    await this.authService.revokeSession(id, request.userId);
    return { success: true };
  }
```

- [ ] **Step 4: Build kiểm tra**

Run: `cd api && npm run build`
Expected: build pass.

- [ ] **Step 5: Commit**

```bash
git add api/src/auth/auth.controller.ts
git commit -m "feat(auth): refresh/switch/logout/accounts/devices/sessions endpoints"
```

---

## Task 12: AuthModule wiring + full verification

**Files:**
- Modify: `api/src/auth/auth.module.ts`

- [ ] **Step 1: Đăng ký providers mới**

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AccessTokenGuard } from '../common/guards/access-token.guard';
import { GoogleStrategy } from '../common/strategies/google.strategy';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DeviceService } from './device.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Module({
  imports: [PassportModule.register({ session: false }), DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, TokenService, SessionService, DeviceService, AccessTokenGuard],
})
export class AuthModule {}
```

- [ ] **Step 2: Chạy toàn bộ test**

Run: `cd api && npm test`
Expected: tất cả suite PASS.

- [ ] **Step 3: Build production**

Run: `cd api && npm run build`
Expected: build pass, không lỗi type.

- [ ] **Step 4: Lint**

Run: `cd api && npm run lint`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add api/src/auth/auth.module.ts
git commit -m "feat(auth): register SessionService/DeviceService/AccessTokenGuard"
```

- [ ] **Step 6: Cập nhật spec FE contract (nếu có tài liệu FE)** — ghi chú: FE phải gửi `deviceFingerprint` (và tùy chọn `deviceName`) trong body `POST /auth/google/exchange`; refresh/switch/logout dựa vào cookie; `GET /auth/devices` và `DELETE /auth/sessions/:id` cần header `Authorization: Bearer <accessToken>`.

```bash
git add -A && git commit -m "docs(auth): note FE contract for device fingerprint" --allow-empty
```

---

## Self-review notes (đã kiểm)

- **Spec coverage:** schema (Task 2), error codes (Task 3), platform parse (Task 4), verify token (Task 5), session/rotation/reuse (Task 6), device (Task 7), DTOs (Task 8), guard (Task 9), orchestration exchange/refresh/switch/logout/list/revoke (Task 10), endpoints (Task 11), wiring (Task 12). Tất cả mục §3–§9 của spec có task tương ứng.
- **Type consistency:** `PrismaTx` định nghĩa ở `session.service.ts`, import lại ở `device.service.ts`. Tên method khớp giữa Task 6/7/10/11 (`createSession`, `rotateByRawToken`, `validateActiveRawToken`, `issueFreshTokenForSession`, `findActiveSession`, `revokeByRawToken`, `revokeSessionOwnedByUser`, `listByUser`, `upsertDevice`, `activateDeviceUser`, `listAccountsByDevice`). DeviceUser composite key dùng `device_id_user_id` (Prisma sinh từ `@@unique([device_id, user_id])`).
- **Redis:** chỉ còn dùng cho login code; refresh hash chuyển hẳn sang DB (Task 10 bỏ `CACHE_REFRESH_HASH_PREFIX`).
- **Ngoài phạm vi:** e2e với Postgres thật, Redis cache cho refresh, device_token cookie, giới hạn số account/máy — không thực hiện (theo §10 spec).
