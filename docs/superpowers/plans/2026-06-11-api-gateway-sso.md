# API Gateway + SSO (edge auth qua Redis) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa `api-gateway` thành cổng public duy nhất (:8000) "bắt mạng" mọi request, validate session bằng Redis và inject identity header xuống downstream; `api` đổi tên thành `sso` (:8001) lo login/cấp phiên và ghi session vào Redis.

**Architecture:** Edge auth tại gateway. SSO ghi session vào Redis (`session:{token_hash}` → JSON, TTL) + Postgres (source of truth). Gateway đọc Redis để validate, inject `X-User-*`, strip header giả mạo, proxy `/auth/*` + `/api/*` sang SSO bằng `http-proxy-middleware`. SSO endpoint bảo vệ tin header `X-User-Id`. CORS/CSRF di dời từ `api` sang gateway.

**Tech Stack:** NestJS 11, `http-proxy-middleware`, `redis` (node-redis), Passport Google OAuth, Prisma/Postgres, Redis.

**Tham chiếu spec:** `docs/superpowers/specs/2026-06-11-api-gateway-sso-design.md`

**Quy ước repo (BẮT BUỘC):**
- Mọi hàm có comment tiếng Việt 2 dòng `Input:` / `Output:`.
- KHÔNG commit spec test: viết spec để verify → chạy → **xóa** trước khi commit (theo convention repo).
- Chỉ build phần thay đổi. Comment/đặt tên theo code xung quanh.

---

## File Structure

**Gateway (`api-gateway/`) — xây trên scaffold sẵn:**
- `src/common/constants/error-codes.constant.ts` — ERROR_CODES tối thiểu (AUTH_001/005/006) cho envelope lỗi FE-facing.
- `src/common/exceptions/app.exception.ts` — AppException map status (mirror gọn của SSO).
- `src/common/exceptions/http-exception.filter.ts` — filter trả `{success,code,message}`.
- `src/common/utils/origin.util.ts` — allowlist origin (chuyển từ `api`).
- `src/session/session-store.module.ts` — provider node-redis client (connected).
- `src/session/session-store.service.ts` — đọc session theo token_hash + sliding-renew TTL.
- `src/session/session.constants.ts` — key prefix, TTL, ngưỡng renew, tên header, tên cookie.
- `src/auth/gateway-auth.middleware.ts` — validate Redis, strip + inject `X-User-*`.
- `src/auth/auth-paths.ts` — phân loại route public vs protected.
- `src/common/middleware/csrf.middleware.ts` — CSRF Origin/Referer (middleware, chuyển từ `api`).
- `src/proxy/proxy.middleware.ts` — http-proxy-middleware → SSO.
- `src/app.module.ts`, `src/main.ts` — wiring, CORS, port 8000.
- `.env`, `.env.example` — PORT, SSO_URL, REDIS_*, CORS_ALLOWED_ORIGINS, COOKIE_DOMAIN.

**SSO (`sso/`, đổi tên từ `api/`):**
- `src/auth/session.service.ts` — Modify: create/refresh → ghi Redis; revoke → xóa Redis.
- `src/auth/session-redis.service.ts` — Create: ghi/xóa Redis key (node-redis).
- `src/auth/auth.module.ts` — Modify: provide session-redis service.
- `src/common/guards/gateway-user.guard.ts` — Create: đọc `X-User-Id` → req.userId.
- `src/auth/auth.controller.ts` — Modify: thay `SessionGuard` bằng `GatewayUserGuard`.
- `src/main.ts` — Modify: bỏ enableCors (không browser-facing nữa).
- `src/app.module.ts` — Modify: bỏ đăng ký CsrfGuard.
- Remove: `src/common/guards/csrf.guard.ts`, `src/common/utils/origin.util.ts`, `src/common/guards/session.guard.ts` (nếu không còn dùng).
- `.env`, `.env.example` — PORT=8001.

**Root:**
- `api-gateway/.git` — Remove (để monorepo track gateway).
- `docker-compose.yml` — Modify env_file path khi đổi tên (`./api/.env` → `./sso/.env`).

---

## Phase 0 — Đưa gateway vào monorepo + đổi tên api→sso

### Task 1: Track api-gateway trong monorepo

**Files:**
- Remove: `api-gateway/.git`

- [ ] **Step 1: Xóa nested git repo của gateway**

```bash
rm -rf api-gateway/.git
```

- [ ] **Step 2: Verify gateway đã được root repo nhìn thấy**

Run: `git status --short api-gateway | head`
Expected: Liệt kê các file trong `api-gateway/` dưới dạng untracked (`?? api-gateway/...`), KHÔNG còn là một dòng `?? api-gateway/` gộp.

- [ ] **Step 3: Commit**

```bash
git add api-gateway
git commit -m "chore(gateway): track api-gateway scaffold in monorepo"
```

---

### Task 2: Đổi tên `api` → `sso`

**Files:**
- Modify: `api/` → `sso/` (git mv)
- Modify: `sso/package.json` (name)
- Modify: `docker-compose.yml:7` (env_file path)

- [ ] **Step 1: Đổi tên thư mục bằng git mv**

```bash
git mv api sso
```

- [ ] **Step 2: Đổi `name` trong package.json**

Sửa `sso/package.json` field `"name"` (nếu có giá trị `api` hoặc tương tự) thành:

```json
  "name": "sso",
```

(Nếu name vốn là `joytab-api` hay tương tự, đổi sang `joytab-sso` cho nhất quán.)

- [ ] **Step 3: Cập nhật docker-compose env_file path**

Trong `docker-compose.yml`, đổi:

```yaml
    env_file:
      - ./api/.env
```

thành:

```yaml
    env_file:
      - ./sso/.env
```

- [ ] **Step 4: Tìm tham chiếu đường dẫn `api/` còn sót**

Run: `grep -rn "\bapi/" --include='*.json' --include='*.yml' --include='*.yaml' --include='*.ts' sso docker-compose.yml 2>/dev/null | grep -v node_modules | grep -vE "/api/auth|/api/|api/v" | head -30`
Expected: Không có dòng nào trỏ tới thư mục `api/` cũ (đường dẫn HTTP `/api/...` thì bỏ qua). Sửa nếu còn.

- [ ] **Step 5: Build SSO để chắc rename không vỡ import**

Run: `cd sso && npx tsc -p tsconfig.json --noEmit`
Expected: Không lỗi.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename api service to sso"
```

---

## Phase 1 — SSO ghi session vào Redis + port 8001

### Task 3: SessionRedisService (ghi/xóa Redis key)

**Files:**
- Create: `sso/src/auth/session-redis.service.ts`
- Modify: `sso/src/auth/auth.module.ts`

Dùng node-redis (`createClient` đã có sẵn qua `@keyv/redis`, hoặc cài `redis`). Key/value theo "session contract" (spec mục 7). Kết nối tạo lazy 1 lần.

- [ ] **Step 1: Cài node-redis nếu chưa có**

Run: `cd sso && node -e "require('redis')" 2>/dev/null && echo HAS_REDIS || npm i redis`
Expected: `HAS_REDIS` hoặc cài xong `redis`.

- [ ] **Step 2: Viết SessionRedisService**

Create `sso/src/auth/session-redis.service.ts`:

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { SESSION_TTL_MS } from './auth.constants';

/** Giá trị session lưu trong Redis cho gateway đọc validate. */
export type SessionPayload = { userId: string; email: string; sessionId: string; deviceId: string };

@Injectable()
export class SessionRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionRedisService.name);
  private client: RedisClientType;

  /**
   * Input: ConfigService chứa REDIS_HOST/PORT/PASSWORD/DB.
   * Output: Khởi tạo client node-redis (chưa kết nối — kết nối ở onModuleInit).
   */
  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<string>('REDIS_PORT');
    const password = (this.configService.get<string>('REDIS_PASSWORD') ?? '').trim();
    const db = this.configService.get<string>('REDIS_DB') ?? '0';
    const auth = password ? `:${password}@` : '';
    this.client = createClient({ url: `redis://${auth}${host}:${port}/${db}` });
    this.client.on('error', (err: Error) => this.logger.error(`Redis error: ${err.message}`));
  }

  /**
   * Input: Không có.
   * Output: Mở kết nối Redis khi module khởi động.
   */
  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Input: Không có.
   * Output: Đóng kết nối Redis khi app shutdown.
   */
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Input: token_hash của session + payload + TTL (ms, mặc định SESSION_TTL_MS).
   * Output: Ghi key session:{hash} = JSON payload với TTL để gateway validate.
   */
  async putSession(tokenHash: string, payload: SessionPayload, ttlMs: number = SESSION_TTL_MS): Promise<void> {
    await this.client.set(`session:${tokenHash}`, JSON.stringify(payload), { PX: ttlMs });
  }

  /**
   * Input: token_hash của session cần thu hồi.
   * Output: Xóa key Redis tương ứng (logout/revoke).
   */
  async deleteSession(tokenHash: string): Promise<void> {
    await this.client.del(`session:${tokenHash}`);
  }
}
```

- [ ] **Step 3: Provide trong AuthModule**

Modify `sso/src/auth/auth.module.ts` — thêm `SessionRedisService` vào providers:

```ts
import { SessionRedisService } from './session-redis.service';
// ...
  providers: [AuthService, GoogleStrategy, TokenService, SessionService, DeviceService, SessionRedisService],
```

- [ ] **Step 4: Build**

Run: `cd sso && npx tsc -p tsconfig.json --noEmit`
Expected: Không lỗi.

- [ ] **Step 5: Commit**

```bash
git add sso/src/auth/session-redis.service.ts sso/src/auth/auth.module.ts sso/package.json sso/package-lock.json
git commit -m "feat(sso): add SessionRedisService for gateway session store"
```

---

### Task 4: Ghi/xóa Redis trong SessionService

SessionService cần `token_hash` (đang có khi tạo token) + payload (userId, email, sessionId, deviceId) để ghi Redis. Hiện `createSession`/`createOrRefreshSession` chỉ trả raw. Cần lấy thêm email — `createOrRefreshSession` được gọi trong `loginWithGoogle` (đã có user.email).

**Files:**
- Modify: `sso/src/auth/session.service.ts`

- [ ] **Step 1: Inject SessionRedisService vào SessionService**

Modify constructor `sso/src/auth/session.service.ts`:

```ts
import { SessionRedisService } from './session-redis.service';
// ...
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tokenService: TokenService,
    private readonly sessionRedisService: SessionRedisService,
  ) {}
```

- [ ] **Step 2: Ghi Redis khi createSession**

Modify `createSession` — sau khi tạo row, ghi Redis (cần email → thêm tham số email):

```ts
  /**
   * Input: userId, email, deviceId, transaction client.
   * Output: Tạo session mới (Postgres) + ghi Redis key; trả { sessionId, sessionTokenRaw }.
   */
  async createSession(
    params: { userId: string; email: string; deviceId: string },
    tx: PrismaTx,
  ): Promise<{ sessionId: string; sessionTokenRaw: string }> {
    const { raw, hash } = this.tokenService.createSessionToken();
    const session = await tx.userSession.create({
      data: {
        user_id: params.userId,
        device_id: params.deviceId,
        token_hash: hash,
        expires_at: new Date(Date.now() + this.tokenService.getSessionTtlMs()),
        last_used_at: new Date(),
      },
    });
    await this.sessionRedisService.putSession(hash, {
      userId: params.userId,
      email: params.email,
      sessionId: session.id,
      deviceId: params.deviceId,
    });
    return { sessionId: session.id, sessionTokenRaw: raw };
  }
```

- [ ] **Step 3: Ghi Redis khi createOrRefreshSession (refresh nhánh)**

Modify `createOrRefreshSession` — đổi chữ ký nhận email, ghi Redis ở cả nhánh refresh và create:

```ts
  /**
   * Input: userId, email, deviceId, transaction client.
   * Output: Có phiên sống → cấp token mới + ghi Redis; chưa có → tạo mới. Trả raw token.
   */
  async createOrRefreshSession(params: { userId: string; email: string; deviceId: string }, tx: PrismaTx): Promise<string> {
    const existing = await tx.userSession.findFirst({
      where: { user_id: params.userId, device_id: params.deviceId, is_revoked: false, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
    if (existing) {
      const { raw, hash } = this.tokenService.createSessionToken();
      await tx.userSession.update({
        where: { id: existing.id },
        data: {
          token_hash: hash,
          last_used_at: new Date(),
          expires_at: new Date(Date.now() + this.tokenService.getSessionTtlMs()),
        },
      });
      await this.sessionRedisService.putSession(hash, {
        userId: params.userId,
        email: params.email,
        sessionId: existing.id,
        deviceId: params.deviceId,
      });
      return raw;
    }
    const created = await this.createSession(params, tx);
    return created.sessionTokenRaw;
  }
```

- [ ] **Step 4: Xóa Redis khi switchActiveSession cấp token mới**

Trong `switchActiveSession`, sau khi update token_hash mới cần ghi Redis key mới (token cũ sẽ tự hết TTL; nhưng key cũ vẫn sống tới TTL — chấp nhận, hoặc xóa key cũ). Ghi key mới:

```ts
  /**
   * Input: deviceId, userId đích, transaction client.
   * Output: Account còn phiên sống → cấp token mới + ghi Redis; ngược lại AUTH_001.
   */
  async switchActiveSession(params: { deviceId: string; userId: string }, tx: PrismaTx): Promise<string> {
    const link = await tx.deviceUser.findUnique({
      where: { device_id_user_id: { device_id: params.deviceId, user_id: params.userId } },
    });
    if (!link) throw new AppException(ERROR_CODES.AUTH_001);
    const session = await tx.userSession.findFirst({
      where: { user_id: params.userId, device_id: params.deviceId, is_revoked: false, expires_at: { gt: new Date() } },
      include: { user: true },
      orderBy: { created_at: 'desc' },
    });
    if (!session) throw new AppException(ERROR_CODES.AUTH_001);
    const { raw, hash } = this.tokenService.createSessionToken();
    await tx.userSession.update({
      where: { id: session.id },
      data: {
        token_hash: hash,
        last_used_at: new Date(),
        expires_at: new Date(Date.now() + this.tokenService.getSessionTtlMs()),
      },
    });
    await this.sessionRedisService.putSession(hash, {
      userId: params.userId,
      email: session.user.email,
      sessionId: session.id,
      deviceId: params.deviceId,
    });
    return raw;
  }
```

- [ ] **Step 5: Xóa Redis khi revoke**

Modify `revokeByRawToken` và `revokeSessionOwnedByUser` để xóa Redis key. `revokeByRawToken` đã có hash; `revokeSessionOwnedByUser` cần lấy token_hash từ row:

```ts
  /**
   * Input: raw session token, transaction client.
   * Output: Revoke session sở hữu token + xóa Redis key. Bỏ qua nếu không khớp.
   */
  async revokeByRawToken(rawToken: string, tx: PrismaTx): Promise<void> {
    const hash = this.tokenService.hashToken(rawToken);
    const session = await tx.userSession.findUnique({ where: { token_hash: hash } });
    if (!session) return;
    await this.revokeSession(session.id, 'logout', tx);
    await this.sessionRedisService.deleteSession(hash);
  }

  /**
   * Input: sessionId, userId chủ sở hữu, transaction client.
   * Output: Revoke session + xóa Redis key nếu thuộc user; AUTH_001 nếu không sở hữu.
   */
  async revokeSessionOwnedByUser(sessionId: string, userId: string, tx: PrismaTx): Promise<void> {
    const session = await tx.userSession.findFirst({ where: { id: sessionId, user_id: userId } });
    if (!session) throw new AppException(ERROR_CODES.AUTH_001);
    await this.revokeSession(sessionId, 'revoked_remote', tx);
    await this.sessionRedisService.deleteSession(session.token_hash);
  }
```

- [ ] **Step 6: Cập nhật AuthService gọi createOrRefreshSession với email**

Modify `sso/src/auth/auth.service.ts` trong `loginWithGoogle`:

```ts
      const sessionTokenRaw = await this.sessionService.createOrRefreshSession(
        { userId: user.id, email: user.email, deviceId: device.id },
        tx,
      );
```

- [ ] **Step 7: Build**

Run: `cd sso && npx tsc -p tsconfig.json --noEmit`
Expected: Không lỗi.

- [ ] **Step 8: Verify nhanh bằng spec tạm (rồi XÓA)**

Create `sso/src/auth/session.service.redis.spec.ts`:

```ts
import { SessionService } from './session.service';

describe('SessionService ghi Redis', () => {
  it('createSession ghi key session:{hash} với payload đúng', async () => {
    const put = jest.fn();
    const tokenService = {
      createSessionToken: () => ({ raw: 'raw', hash: 'HASH' }),
      getSessionTtlMs: () => 1000,
    } as any;
    const tx = { userSession: { create: jest.fn().mockResolvedValue({ id: 'S1' }) } } as any;
    const svc = new SessionService({} as any, tokenService, { putSession: put } as any);
    const res = await svc.createSession({ userId: 'U1', email: 'a@b.c', deviceId: 'D1' }, tx);
    expect(res).toEqual({ sessionId: 'S1', sessionTokenRaw: 'raw' });
    expect(put).toHaveBeenCalledWith('HASH', { userId: 'U1', email: 'a@b.c', sessionId: 'S1', deviceId: 'D1' });
  });
});
```

Run: `cd sso && npx jest session.service.redis --silent`
Expected: PASS 1 test.

- [ ] **Step 9: Xóa spec tạm**

```bash
rm sso/src/auth/session.service.redis.spec.ts
```

- [ ] **Step 10: Commit**

```bash
git add sso/src/auth/session.service.ts sso/src/auth/auth.service.ts
git commit -m "feat(sso): write/delete Redis session on create/refresh/switch/revoke"
```

---

### Task 5: SSO port 8001

**Files:**
- Modify: `sso/.env`, `sso/.env.example`

- [ ] **Step 1: Đổi PORT sang 8001**

Trong `sso/.env` và `sso/.env.example` đổi:

```
PORT=8001
```

Giữ nguyên `API_URL=http://localhost:8000` (URL public = gateway, dùng dựng OAuth redirect_uri).

- [ ] **Step 2: Verify**

Run: `grep -E '^(PORT|API_URL)=' sso/.env`
Expected: `PORT=8001` và `API_URL=http://localhost:8000`.

- [ ] **Step 3: Commit**

```bash
git add sso/.env.example
git commit -m "chore(sso): listen on internal port 8001"
```
(Lưu ý: `sso/.env` thường bị gitignore — chỉ commit `.env.example`.)

---

## Phase 2 — SSO tin header gateway + gỡ CORS/CSRF

### Task 6: GatewayUserGuard (đọc X-User-Id)

**Files:**
- Create: `sso/src/common/guards/gateway-user.guard.ts`

- [ ] **Step 1: Viết guard**

Create `sso/src/common/guards/gateway-user.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';

@Injectable()
export class GatewayUserGuard implements CanActivate {
  /**
   * Input: ExecutionContext của request đã qua gateway.
   * Output: true nếu có header X-User-Id (gán req.userId/req.userEmail); ném AUTH_001 nếu thiếu.
   *         An toàn vì SSO chỉ gateway gọi tới; gateway đã strip header giả mạo từ client.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; userEmail?: string }>();
    const userId = request.headers['x-user-id'];
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new AppException(ERROR_CODES.AUTH_001);
    }
    request.userId = userId;
    const email = request.headers['x-user-email'];
    if (typeof email === 'string') request.userEmail = email;
    return true;
  }
}
```

- [ ] **Step 2: Thay SessionGuard bằng GatewayUserGuard trong controller**

Modify `sso/src/auth/auth.controller.ts`:
- Đổi import `SessionGuard` → `GatewayUserGuard`.
- Thay cả 3 chỗ `@UseGuards(SessionGuard)` (routes `me`, `devices`, `sessions/:id`) thành `@UseGuards(GatewayUserGuard)`.

```ts
import { GatewayUserGuard } from '../common/guards/gateway-user.guard';
// ...
  @Get('me')
  @UseGuards(GatewayUserGuard)
  // ...
  @Get('devices')
  @UseGuards(GatewayUserGuard)
  // ...
  @Delete('sessions/:id')
  @UseGuards(GatewayUserGuard)
```

- [ ] **Step 3: Xóa SessionGuard không còn dùng**

Run: `grep -rn "SessionGuard" sso/src | grep -v node_modules`
Expected: Không còn tham chiếu nào. Nếu sạch:

```bash
rm sso/src/common/guards/session.guard.ts
```

(SessionService vẫn giữ — vẫn dùng cho create/revoke/list.)

- [ ] **Step 4: Build**

Run: `cd sso && npx tsc -p tsconfig.json --noEmit`
Expected: Không lỗi.

- [ ] **Step 5: Commit**

```bash
git add -A sso/src
git commit -m "feat(sso): trust gateway X-User-Id header on protected routes"
```

---

### Task 7: Gỡ CORS/CSRF khỏi SSO (chuyển sang gateway)

**Files:**
- Modify: `sso/src/main.ts`, `sso/src/app.module.ts`
- Remove: `sso/src/common/guards/csrf.guard.ts`, `sso/src/common/utils/origin.util.ts`

- [ ] **Step 1: Bỏ enableCors trong main.ts**

Modify `sso/src/main.ts` — xóa block `app.enableCors({...})` và import `isOriginAllowed, resolveOriginAllowlist` cùng biến `allowlist`. Giữ `helmet`.

- [ ] **Step 2: Bỏ đăng ký CsrfGuard trong app.module.ts**

Modify `sso/src/app.module.ts` — xóa import `CsrfGuard` và dòng `{ provide: APP_GUARD, useClass: CsrfGuard }`. Giữ ThrottlerGuard.

- [ ] **Step 3: Xóa file CSRF/origin util của SSO**

```bash
rm sso/src/common/guards/csrf.guard.ts sso/src/common/utils/origin.util.ts
```

- [ ] **Step 4: Dọn hằng CSRF không dùng + AUTH_006 (nếu muốn sạch)**

Trong `sso/src/auth/auth.constants.ts` xóa block `// ===== CSRF =====` (CSRF_SAFE_METHODS, CORS_ALLOWED_ORIGINS_ENV).
Giữ `AUTH_006` trong error-codes nếu còn nơi khác dùng; nếu không, có thể để lại (vô hại).

- [ ] **Step 5: Build**

Run: `cd sso && npx tsc -p tsconfig.json --noEmit`
Expected: Không lỗi (nếu lỗi do còn import origin.util → xóa nốt import).

- [ ] **Step 6: Commit**

```bash
git add -A sso/src
git commit -m "refactor(sso): remove CORS/CSRF (moved to gateway)"
```

---

## Phase 3 — Gateway

### Task 8: Gateway deps + config + bootstrap port 8000

**Files:**
- Modify: `api-gateway/package.json` (deps)
- Modify: `api-gateway/src/main.ts`
- Create: `api-gateway/.env`, `api-gateway/.env.example`

- [ ] **Step 1: Cài deps**

```bash
cd api-gateway && npm i @nestjs/config http-proxy-middleware redis
```

- [ ] **Step 2: Tạo .env.example**

Create `api-gateway/.env.example`:

```
# Cổng public của gateway (FE đang gọi sẵn :8000)
PORT=8000
# URL nội bộ của SSO service
SSO_URL=http://localhost:8001
# Redis (đọc session để validate) — trùng cấu hình SSO
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
# Allowlist origin cho CORS + CSRF (phân tách dấu phẩy; hỗ trợ https://*.example.com)
CORS_ALLOWED_ORIGINS=http://localhost:3000
# Cookie domain dùng chung cross-subdomain (rỗng = host-only dev)
COOKIE_DOMAIN=
NODE_ENV=development
```

Create `api-gateway/.env` với giá trị dev tương tự (PORT=8000, SSO_URL=http://localhost:8001, REDIS_* trùng `sso/.env`).

- [ ] **Step 3: Bật ConfigModule + port + shutdown hooks trong main.ts**

Replace `api-gateway/src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * Input: Không có tham số.
 * Output: Khởi tạo gateway NestJS, bật helmet + shutdown hooks, listen PORT (default 8000).
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 8000);
}
bootstrap().catch((err) => {
  console.error('Fatal error during gateway bootstrap:', err);
  process.exit(1);
});
```

Run: `cd api-gateway && npm i helmet` (nếu chưa có).

- [ ] **Step 4: ConfigModule global trong app.module.ts**

Modify `api-gateway/src/app.module.ts` — thêm:

```ts
import { ConfigModule } from '@nestjs/config';
// trong imports:
    ConfigModule.forRoot({ isGlobal: true }),
```

- [ ] **Step 5: Build**

Run: `cd api-gateway && npx tsc -p tsconfig.json --noEmit`
Expected: Không lỗi.

- [ ] **Step 6: Commit**

```bash
git add api-gateway/package.json api-gateway/package-lock.json api-gateway/.env.example api-gateway/src/main.ts api-gateway/src/app.module.ts
git commit -m "chore(gateway): deps, config, helmet, listen on :8000"
```

---

### Task 9: Session constants + SessionStoreService (đọc Redis + renew TTL)

**Files:**
- Create: `api-gateway/src/session/session.constants.ts`
- Create: `api-gateway/src/session/session-store.service.ts`
- Create: `api-gateway/src/session/session-store.module.ts`

- [ ] **Step 1: Hằng session (đồng bộ với SSO)**

Create `api-gateway/src/session/session.constants.ts`:

```ts
/** Hằng "session contract" — phải khớp với SSO (spec mục 7). */
const MS_PER_SECOND = 1000;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * MS_PER_SECOND;
export const SESSION_RENEW_THRESHOLD_MS = 24 * 60 * 60 * MS_PER_SECOND;
export const SESSION_KEY_PREFIX = 'session:';
export const SESSION_COOKIE_NAME = 'session_id';
export const DEVICE_COOKIE_NAME = 'device_id';
// Header identity gateway inject xuống downstream.
export const HEADER_USER_ID = 'x-user-id';
export const HEADER_USER_EMAIL = 'x-user-email';
export const HEADER_SESSION_ID = 'x-session-id';
export const HEADER_DEVICE_ID = 'x-device-id';
```

- [ ] **Step 2: SessionStoreService**

Create `api-gateway/src/session/session-store.service.ts`:

```ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { createClient, RedisClientType } from 'redis';
import { SESSION_KEY_PREFIX, SESSION_RENEW_THRESHOLD_MS, SESSION_TTL_MS } from './session.constants';

export type SessionPayload = { userId: string; email: string; sessionId: string; deviceId: string };

@Injectable()
export class SessionStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionStoreService.name);
  private client: RedisClientType;

  /**
   * Input: ConfigService chứa REDIS_*.
   * Output: Khởi tạo client node-redis (kết nối ở onModuleInit).
   */
  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<string>('REDIS_PORT');
    const password = (this.configService.get<string>('REDIS_PASSWORD') ?? '').trim();
    const db = this.configService.get<string>('REDIS_DB') ?? '0';
    const auth = password ? `:${password}@` : '';
    this.client = createClient({ url: `redis://${auth}${host}:${port}/${db}` });
    this.client.on('error', (err: Error) => this.logger.error(`Redis error: ${err.message}`));
  }

  /**
   * Input: Không có.
   * Output: Mở kết nối Redis khi gateway khởi động.
   */
  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Input: Không có.
   * Output: Đóng kết nối khi shutdown.
   */
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Input: raw session token (từ cookie).
   * Output: SHA-256 hex để tra key Redis (khớp cách SSO băm token).
   */
  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Input: raw session token từ cookie.
   * Output: SessionPayload nếu key còn sống (sliding-renew TTL nếu dưới ngưỡng); null nếu không có/hết hạn.
   */
  async validate(rawToken: string): Promise<SessionPayload | null> {
    const key = `${SESSION_KEY_PREFIX}${this.hashToken(rawToken)}`;
    const raw = await this.client.get(key);
    if (!raw) return null;
    const ttl = await this.client.pTTL(key);
    if (ttl >= 0 && ttl < SESSION_RENEW_THRESHOLD_MS) {
      await this.client.pExpire(key, SESSION_TTL_MS);
    }
    try {
      return JSON.parse(raw) as SessionPayload;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 3: SessionStoreModule (global)**

Create `api-gateway/src/session/session-store.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { SessionStoreService } from './session-store.service';

/**
 * Input: Không có.
 * Output: Module global cung cấp SessionStoreService cho middleware auth.
 */
@Global()
@Module({
  providers: [SessionStoreService],
  exports: [SessionStoreService],
})
export class SessionStoreModule {}
```

- [ ] **Step 4: Import module vào app.module.ts**

Modify `api-gateway/src/app.module.ts` — thêm `SessionStoreModule` vào imports.

- [ ] **Step 5: Verify bằng spec tạm (rồi XÓA) — logic renew TTL**

Create `api-gateway/src/session/session-store.service.spec.ts`:

```ts
import { SessionStoreService } from './session-store.service';
import { SESSION_RENEW_THRESHOLD_MS, SESSION_TTL_MS } from './session.constants';

function withClient(client: any): SessionStoreService {
  const svc = new SessionStoreService({ get: () => undefined } as any);
  (svc as any).client = client;
  return svc;
}

describe('SessionStoreService.validate', () => {
  it('trả null khi key không tồn tại', async () => {
    const svc = withClient({ get: jest.fn().mockResolvedValue(null), pTTL: jest.fn(), pExpire: jest.fn() });
    expect(await svc.validate('raw')).toBeNull();
  });

  it('trả payload và KHÔNG renew khi TTL còn nhiều', async () => {
    const pExpire = jest.fn();
    const payload = { userId: 'U', email: 'e', sessionId: 'S', deviceId: 'D' };
    const svc = withClient({
      get: jest.fn().mockResolvedValue(JSON.stringify(payload)),
      pTTL: jest.fn().mockResolvedValue(SESSION_TTL_MS - 1),
      pExpire,
    });
    expect(await svc.validate('raw')).toEqual(payload);
    expect(pExpire).not.toHaveBeenCalled();
  });

  it('renew TTL khi dưới ngưỡng', async () => {
    const pExpire = jest.fn();
    const payload = { userId: 'U', email: 'e', sessionId: 'S', deviceId: 'D' };
    const svc = withClient({
      get: jest.fn().mockResolvedValue(JSON.stringify(payload)),
      pTTL: jest.fn().mockResolvedValue(SESSION_RENEW_THRESHOLD_MS - 1),
      pExpire,
    });
    await svc.validate('raw');
    expect(pExpire).toHaveBeenCalledWith(expect.any(String), SESSION_TTL_MS);
  });
});
```

Run: `cd api-gateway && npx jest session-store.service --silent`
Expected: PASS 3 tests.

- [ ] **Step 6: Xóa spec tạm**

```bash
rm api-gateway/src/session/session-store.service.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add api-gateway/src/session api-gateway/src/app.module.ts
git commit -m "feat(gateway): Redis session store with sliding-renew TTL"
```

---

### Task 10: Phân loại route + gateway auth middleware (validate + inject/strip)

**Files:**
- Create: `api-gateway/src/auth/auth-paths.ts`
- Create: `api-gateway/src/auth/gateway-auth.middleware.ts`
- Create: `api-gateway/src/common/constants/error-codes.constant.ts`
- Create: `api-gateway/src/common/exceptions/app.exception.ts`
- Create: `api-gateway/src/common/exceptions/http-exception.filter.ts`

- [ ] **Step 1: Error codes tối thiểu (envelope FE-facing)**

Create `api-gateway/src/common/constants/error-codes.constant.ts`:

```ts
export const ERROR_CODES = {
  AUTH_001: { code: 'AUTH_001', message: 'Unauthorized' },
  AUTH_005: { code: 'AUTH_005', message: 'Session expired' },
  AUTH_006: { code: 'AUTH_006', message: 'Request origin not allowed' },
} as const;

export type ErrorCodeItem = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

- [ ] **Step 2: AppException + filter**

Create `api-gateway/src/common/exceptions/app.exception.ts`:

```ts
import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeItem } from '../constants/error-codes.constant';

export class AppException extends HttpException {
  public readonly code: string;

  /**
   * Input: Error code object chuẩn.
   * Output: HttpException nghiệp vụ — map code sang status (AUTH_006→403, còn lại→401).
   */
  constructor(error: ErrorCodeItem) {
    super(error.message, error.code === 'AUTH_006' ? HttpStatus.FORBIDDEN : HttpStatus.UNAUTHORIZED);
    this.code = error.code;
  }
}
```

Create `api-gateway/src/common/exceptions/http-exception.filter.ts`:

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { AppException } from './app.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * Input: Exception trong pipeline + host.
   * Output: JSON lỗi chuẩn { success, code, message } đồng bộ với SSO/FE.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const code = exception instanceof AppException ? exception.code : 'UNKNOWN_001';
    const message = exception instanceof HttpException ? exception.message : 'Internal server error';
    response.status(status).json({ success: false, code, message });
  }
}
```

Đăng ký filter trong `main.ts`:

```ts
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
// sau khi tạo app:
  app.useGlobalFilters(new HttpExceptionFilter());
```

- [ ] **Step 3: Phân loại route public**

Create `api-gateway/src/auth/auth-paths.ts`:

```ts
/**
 * Route "public" — không bắt buộc session; gateway chỉ inject identity nếu có cookie hợp lệ.
 * Gồm OAuth, switch (dùng device cookie), logout, accounts.
 */
const PUBLIC_PREFIXES = ['/auth/google', '/auth/switch', '/auth/logout', '/auth/accounts'];

/**
 * Input: path của request (vd '/auth/google/callback').
 * Output: true nếu là route public (không bắt buộc xác thực session).
 */
export function isPublicPath(path: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
}
```

- [ ] **Step 4: Gateway auth middleware**

Create `api-gateway/src/auth/gateway-auth.middleware.ts`:

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppException } from '../common/exceptions/app.exception';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import {
  DEVICE_COOKIE_NAME,
  HEADER_DEVICE_ID,
  HEADER_SESSION_ID,
  HEADER_USER_EMAIL,
  HEADER_USER_ID,
  SESSION_COOKIE_NAME,
} from '../session/session.constants';
import { SessionStoreService } from '../session/session-store.service';
import { isPublicPath } from './auth-paths';

@Injectable()
export class GatewayAuthMiddleware implements NestMiddleware {
  /**
   * Input: SessionStoreService để validate session qua Redis.
   * Output: Middleware edge-auth cho gateway.
   */
  constructor(private readonly sessionStore: SessionStoreService) {}

  /**
   * Input: request/response/next.
   * Output: Strip header X-User-* giả mạo; validate session Redis; inject identity khi hợp lệ.
   *         Route bảo vệ thiếu/sai session → 401; route public thì cho qua không identity.
   */
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Chống giả mạo: luôn xóa mọi header identity client tự gửi.
    delete req.headers[HEADER_USER_ID];
    delete req.headers[HEADER_USER_EMAIL];
    delete req.headers[HEADER_SESSION_ID];
    delete req.headers[HEADER_DEVICE_ID];

    const rawToken = readCookie(req.headers.cookie, SESSION_COOKIE_NAME);
    const deviceId = readCookie(req.headers.cookie, DEVICE_COOKIE_NAME);
    const session = rawToken ? await this.sessionStore.validate(rawToken) : null;

    const authed = session !== null && session.deviceId === deviceId;
    if (authed) {
      req.headers[HEADER_USER_ID] = session!.userId;
      req.headers[HEADER_USER_EMAIL] = session!.email;
      req.headers[HEADER_SESSION_ID] = session!.sessionId;
      req.headers[HEADER_DEVICE_ID] = session!.deviceId;
      next();
      return;
    }
    if (isPublicPath(req.path)) {
      next();
      return;
    }
    throw new AppException(ERROR_CODES.AUTH_001);
  }
}

/**
 * Input: header cookie thô + tên cookie.
 * Output: Giá trị cookie (decode) hoặc null.
 */
function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const [k, ...v] = pair.trim().split('=');
    if (k === name) {
      const val = v.join('=');
      if (!val) return null;
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
}
```

- [ ] **Step 5: Verify auth-paths bằng spec tạm (rồi XÓA)**

Create `api-gateway/src/auth/auth-paths.spec.ts`:

```ts
import { isPublicPath } from './auth-paths';

describe('isPublicPath', () => {
  it('public: oauth, switch, logout, accounts', () => {
    expect(isPublicPath('/auth/google')).toBe(true);
    expect(isPublicPath('/auth/google/callback')).toBe(true);
    expect(isPublicPath('/auth/switch')).toBe(true);
    expect(isPublicPath('/auth/logout')).toBe(true);
    expect(isPublicPath('/auth/accounts')).toBe(true);
  });
  it('protected: me, devices, sessions, api', () => {
    expect(isPublicPath('/auth/me')).toBe(false);
    expect(isPublicPath('/auth/devices')).toBe(false);
    expect(isPublicPath('/auth/sessions/abc')).toBe(false);
    expect(isPublicPath('/api/orders')).toBe(false);
  });
});
```

Run: `cd api-gateway && npx jest auth-paths --silent`
Expected: PASS 2 tests.

- [ ] **Step 6: Xóa spec tạm**

```bash
rm api-gateway/src/auth/auth-paths.spec.ts
```

- [ ] **Step 7: Build**

Run: `cd api-gateway && npx tsc -p tsconfig.json --noEmit`
Expected: Không lỗi.

- [ ] **Step 8: Commit**

```bash
git add api-gateway/src/auth api-gateway/src/common api-gateway/src/main.ts
git commit -m "feat(gateway): edge-auth middleware (validate Redis, inject/strip identity)"
```

---

### Task 11: CORS allowlist tại gateway (chuyển từ api)

> CSRF được làm dạng **middleware** ở Task 12 (proxy middleware kết thúc response trước guard/controller nên guard không chạy). Task này chỉ lo CORS + copy origin.util dùng chung.

**Files:**
- Create: `api-gateway/src/common/utils/origin.util.ts` (copy từ commit a0e1122)
- Modify: `api-gateway/src/main.ts` (enableCors allowlist)

- [ ] **Step 1: Copy origin.util.ts**

Lấy nội dung `sso` cũ từ git (commit a0e1122). Create `api-gateway/src/common/utils/origin.util.ts`:

```bash
git show a0e1122:api/src/common/utils/origin.util.ts > api-gateway/src/common/utils/origin.util.ts
```

(Nếu path không tồn tại do rename, tìm bằng: `git show a0e1122 --stat | grep origin.util` rồi `git show a0e1122:<path>`.)

- [ ] **Step 2: enableCors allowlist trong main.ts**

Modify `api-gateway/src/main.ts` — thêm CORS callback (giống commit a0e1122), trước `listen`:

```ts
import { isOriginAllowed, resolveOriginAllowlist } from './common/utils/origin.util';
// ...
  const allowlist = resolveOriginAllowlist((key) => process.env[key]);
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || isOriginAllowed(origin, allowlist)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
  });
```

- [ ] **Step 3: Build**

Run: `cd api-gateway && npx tsc -p tsconfig.json --noEmit`
Expected: Không lỗi.

- [ ] **Step 4: Commit**

```bash
git add api-gateway/src
git commit -m "feat(gateway): CORS origin allowlist at edge"
```

---

### Task 12: Proxy sang SSO (http-proxy-middleware)

**Files:**
- Create: `api-gateway/src/proxy/proxy.middleware.ts`
- Modify: `api-gateway/src/app.module.ts` (apply middleware + auth middleware theo thứ tự)
- Modify: `api-gateway/src/app.controller.ts` / `app.service.ts` (bỏ route mặc định nếu vướng)

Thứ tự xử lý phải là CSRF → auth → proxy, tất cả là **middleware** (proxy middleware kết thúc response trước khi tới guard/controller, nên guard không chạy được). Chuỗi `forRoutes('/auth', '/api')`: CsrfMiddleware → GatewayAuthMiddleware → ProxyMiddleware.

- [ ] **Step 1: Tạo CsrfMiddleware**

Create `api-gateway/src/common/middleware/csrf.middleware.ts`:

```ts
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';
import { isOriginAllowed, OriginMatcher, resolveOriginAllowlist } from '../utils/origin.util';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);
  private readonly allowlist: OriginMatcher[];

  /**
   * Input: ConfigService đọc allowlist origin.
   * Output: Middleware CSRF parse allowlist sẵn.
   */
  constructor(private readonly configService: ConfigService) {
    this.allowlist = resolveOriginAllowlist((key) => this.configService.get<string>(key));
  }

  /**
   * Input: request/response/next.
   * Output: Cho qua method an toàn; mutation phải có Origin/Referer thuộc allowlist, không thì ném AUTH_006.
   */
  use(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = (req.headers.origin as string | undefined) ?? originFromReferer(req.headers.referer);
    if (!isOriginAllowed(origin, this.allowlist)) {
      this.logger.warn(`CSRF chặn ${req.method} ${req.url} — origin: ${origin ?? '(none)'}`);
      throw new AppException(ERROR_CODES.AUTH_006);
    }
    next();
  }
}

/**
 * Input: header referer.
 * Output: origin trích từ referer hoặc null.
 */
function originFromReferer(referer: string | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
```

(Task 11 không tạo CSRF guard nên không có gì phải xóa ở đây.)

- [ ] **Step 2: Proxy middleware**

Create `api-gateway/src/proxy/proxy.middleware.ts`:

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly proxy: RequestHandler;

  /**
   * Input: ConfigService chứa SSO_URL.
   * Output: Khởi tạo proxy stream sang SSO, giữ nguyên path, forward cookie + Set-Cookie + redirect 302.
   */
  constructor(private readonly configService: ConfigService) {
    const target = this.configService.get<string>('SSO_URL') ?? 'http://localhost:8001';
    this.proxy = createProxyMiddleware({
      target,
      changeOrigin: false,
      xfwd: true,
      // Giữ nguyên Set-Cookie/redirect; http-proxy-middleware mặc định stream nguyên trạng.
    });
  }

  /**
   * Input: request/response/next.
   * Output: Đẩy request xuống SSO.
   */
  use(req: Request, res: Response, next: NextFunction): void {
    this.proxy(req, res, next);
  }
}
```

- [ ] **Step 3: Wiring middleware theo thứ tự trong app.module.ts**

Modify `api-gateway/src/app.module.ts` — implement NestModule.configure:

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionStoreModule } from './session/session-store.module';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { GatewayAuthMiddleware } from './auth/gateway-auth.middleware';
import { ProxyMiddleware } from './proxy/proxy.middleware';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SessionStoreModule],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  /**
   * Input: MiddlewareConsumer.
   * Output: Áp chuỗi CSRF → auth → proxy cho /auth và /api theo đúng thứ tự.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfMiddleware, GatewayAuthMiddleware, ProxyMiddleware).forRoutes('/auth', '/api');
  }
}
```

Lưu ý: bỏ AppController/AppService mặc định khỏi module (xóa khai báo trong @Module). Có thể giữ file nhưng không khai báo, hoặc xóa file:

```bash
rm -f api-gateway/src/app.controller.ts api-gateway/src/app.service.ts api-gateway/src/app.controller.spec.ts
```

Đăng ký providers cho middleware có DI: middleware dùng `@Injectable()` + applied trong configure tự được Nest resolve DI, KHÔNG cần thêm vào providers (Nest instantiate middleware classes). Nhưng để chắc chắn DI ConfigService/SessionStoreService hoạt động, giữ chúng global (ConfigModule isGlobal, SessionStoreModule @Global).

- [ ] **Step 4: Build**

Run: `cd api-gateway && npx tsc -p tsconfig.json --noEmit`
Expected: Không lỗi.

- [ ] **Step 5: Commit**

```bash
git add -A api-gateway/src
git commit -m "feat(gateway): proxy /auth and /api to SSO with CSRF+auth chain"
```

---

## Phase 4 — Verify end-to-end

### Task 13: Chạy thật & kiểm luồng

**Prereqs:** Postgres + Redis chạy (`docker compose up -d postgres redis`).

- [ ] **Step 1: Khởi động SSO**

Run (terminal A): `cd sso && npm run dev`
Expected: Log listen :8001, Redis connected.

- [ ] **Step 2: Khởi động Gateway**

Run (terminal B): `cd api-gateway && npm run start:dev`
Expected: Log listen :8000, Redis connected (SessionStoreService).

- [ ] **Step 3: Route bảo vệ chưa login → 401 qua gateway**

Run: `curl -i -s http://localhost:8000/auth/me | head -5`
Expected: `HTTP/1.1 401` và body `{"success":false,"code":"AUTH_001",...}`.

- [ ] **Step 4: CSRF chặn mutation origin lạ**

Run: `curl -i -s -X POST http://localhost:8000/auth/switch -H 'Origin: https://evil.com' | head -5`
Expected: `HTTP/1.1 403` `code":"AUTH_006`.

- [ ] **Step 5: Login Google qua gateway**

Mở trình duyệt: `http://localhost:8000/auth/google`
Expected: Redirect Google → callback `http://localhost:8000/auth/google/callback` → set cookie `session_id`+`device_id` → redirect FE home. Kiểm cookie set ở domain gateway.

- [ ] **Step 6: Sau login, /auth/me trả user qua gateway**

Run (dùng cookie từ trình duyệt, hoặc DevTools): `GET http://localhost:8000/auth/me`
Expected: `200`, trả `{userId, user:{...}}`. Xác nhận SSO nhận `X-User-Id` (log SSO).

- [ ] **Step 7: Kiểm Redis có key session**

Run: `redis-cli KEYS 'session:*' | head`
Expected: Có ít nhất 1 key `session:<hash>`.

- [ ] **Step 8: Logout xóa Redis key**

Gọi `POST http://localhost:8000/auth/logout` (kèm cookie) → rồi `redis-cli KEYS 'session:*'`.
Expected: Key tương ứng biến mất; `/auth/me` sau đó → 401.

- [ ] **Step 9: Cập nhật docs sản phẩm liên quan (theo rule repo)**

Cập nhật (KHÔNG tạo mới) các docs hiện có bị ảnh hưởng:
- `docs/system-architecture-20260522.md` / `docs/thiet-ke-he-thong-20260522.md` — thêm tầng gateway + luồng edge-auth Redis.
- `docs/project-structure-20260522.md` — thêm `api-gateway/`, đổi `api/`→`sso/`.
- `docs/environment-configuration-reference-20260522.md` — env gateway (PORT, SSO_URL, REDIS_*, CORS_ALLOWED_ORIGINS, COOKIE_DOMAIN), SSO PORT=8001.

- [ ] **Step 10: Commit docs**

```bash
git add docs
git commit -m "docs: reflect api-gateway + sso edge-auth architecture"
```

---

## Self-Review (đã kiểm)

- **Spec coverage:** Gateway edge-auth (Task 9,10) ✓ · Redis session store gateway-read + sso-write (Task 3,4,9) ✓ · rename api→sso (Task 2) ✓ · trust X-User-Id (Task 6) ✓ · CORS/CSRF dời sang gateway (Task 7,11,12) ✓ · proxy http-proxy-middleware (Task 12) ✓ · ports 8000/8001 (Task 5,8) ✓ · network isolation HOÃN (ghi rõ, ngoài scope) ✓ · không docker/không đổi FE (gateway chiếm 8000) ✓.
- **Placeholder scan:** Không còn TODO/TBD; mọi step code có nội dung thật.
- **Type consistency:** `SessionPayload {userId,email,sessionId,deviceId}` đồng nhất SSO↔gateway · key `session:{hash}` · `hashToken` SHA-256 hex hai bên · header `x-user-*` thống nhất constants.
- **Lưu ý kỹ thuật:** CSRF ở gateway làm dạng **middleware** (Task 12), không phải guard — vì proxy middleware kết thúc response trước khi tới guard/controller. Chuỗi middleware: CSRF → auth → proxy. Postgres `expires_at` có thể lệch Redis TTL (sliding renew chỉ ở Redis) — chấp nhận trong scope, list/audit không cần độ chính xác giây.
