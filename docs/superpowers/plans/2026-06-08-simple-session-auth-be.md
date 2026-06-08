# Simple Session-Cookie Auth — Backend Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay auth JWT + refresh token bằng session cookie thuần (server tra DB mỗi request), website-only, multi-account qua `device_id` cookie. Chỉ làm backend (`api/`); frontend ở plan sau.

**Architecture:** 2 cookie httpOnly: `session_id` (raw session token, sliding 7 ngày, renew khi còn <1 ngày) và `device_id` (UUID Device do BE tạo, sống 1 năm). `UserSession` lưu `token_hash`; bỏ hẳn model `RefreshToken`, JWT, Bearer header, code/change-token/exchange, `device_fingerprint`. Callback Google set cookie rồi redirect thẳng. Switch account dùng `device_id` + `DeviceUser` để cấp lại session; account hết phiên → 401 (FE bắt login lại).

**Tech Stack:** NestJS 11, Prisma 7 (Postgres), jest + ts-jest, class-validator.

**Quy ước test của repo (QUAN TRỌNG):** repo KHÔNG commit file `.spec.ts`. Mỗi task có test sẽ: viết spec → chạy verify → **xoá spec trước khi commit**. Chỉ commit code nguồn. (Theo memory `delete-spec-after-test`.)

**Spec nguồn:** `docs/superpowers/specs/2026-06-08-simple-session-auth-design.md`

---

## File Structure

| File | Trách nhiệm | Hành động |
|------|-------------|-----------|
| `api/prisma/schema.prisma` | Data model | Modify: bỏ `RefreshToken`, bỏ `device_fingerprint`, thêm `UserSession.token_hash` |
| `api/prisma/migrations/<ts>_simple_session_auth/` | Migration SQL | Create |
| `api/src/auth/auth.constants.ts` | Hằng số cấu hình auth | Rewrite |
| `api/src/auth/token.service.ts` | Sinh/băm session token | Rewrite |
| `api/src/auth/auth.utils.ts` | Helper cookie/redirect/UA/uuid | Modify |
| `api/src/auth/device.service.ts` | Quản lý Device + DeviceUser | Rewrite |
| `api/src/auth/session.service.ts` | Vòng đời UserSession | Rewrite |
| `api/src/common/guards/session.guard.ts` | Xác thực session cookie | Create |
| `api/src/common/guards/access-token.guard.ts` | (cũ) | Delete |
| `api/src/auth/dto/switch-account.dto.ts` | Body `/auth/switch` | Create |
| `api/src/auth/dto/{exchange-google-code,refresh,logout}.dto.ts` | (cũ) | Delete |
| `api/src/auth/auth.service.ts` | Orchestrate nghiệp vụ auth | Rewrite |
| `api/src/auth/auth.controller.ts` | Routes auth | Rewrite |
| `api/src/auth/auth.module.ts` | Wiring | Modify (gỡ provider thừa nếu cần) |

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/<timestamp>_simple_session_auth/migration.sql` (prisma sinh)

- [ ] **Step 1: Sửa model `UserSession`** trong `api/prisma/schema.prisma` — thêm `token_hash`, bỏ quan hệ `refresh_tokens`:

```prisma
model UserSession {
  id            String    @id @default(uuid()) @db.Uuid
  user_id       String    @db.Uuid
  device_id     String    @db.Uuid
  token_hash    String    @unique
  is_revoked    Boolean   @default(false)
  revoked_at    DateTime? @db.Timestamptz(6)
  revoke_reason String?   @db.VarChar(100)
  last_used_at  DateTime? @db.Timestamptz(6)
  expires_at    DateTime  @db.Timestamptz(6)
  created_at    DateTime  @default(now()) @db.Timestamptz(6)
  updated_at    DateTime  @updatedAt @db.Timestamptz(6)
  user          User      @relation(fields: [user_id], references: [id])
  device        Device    @relation(fields: [device_id], references: [id])

  @@index([user_id, is_revoked])
  @@index([device_id, is_revoked])
  @@map("user_sessions")
}
```

- [ ] **Step 2: Xoá hẳn model `RefreshToken`** (cả block) trong `schema.prisma`.

- [ ] **Step 3: Sửa model `Device`** — bỏ field `device_fingerprint`:

```prisma
model Device {
  id            String        @id @default(uuid()) @db.Uuid
  device_name   String?       @db.VarChar(255)
  platform      String?       @db.VarChar(50)
  last_seen_at  DateTime?     @db.Timestamptz(6)
  created_at    DateTime      @default(now()) @db.Timestamptz(6)
  updated_at    DateTime      @updatedAt @db.Timestamptz(6)
  device_users  DeviceUser[]
  user_sessions UserSession[]

  @@map("devices")
}
```

- [ ] **Step 4: Validate schema**

Run: `cd api && npm run db:validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Tạo migration ở chế độ create-only** (để chèn bước xoá dữ liệu cũ)

Run: `cd api && npm run db:migrate:dev -- --create-only --name simple_session_auth`
Expected: tạo thư mục `prisma/migrations/<ts>_simple_session_auth/migration.sql`, chưa apply.

- [ ] **Step 6: Sửa `migration.sql`** — đảm bảo `user_sessions` rỗng trước khi thêm cột NOT NULL unique. Mở file vừa tạo, **chèn dòng sau ngay trước câu lệnh `ALTER TABLE "user_sessions" ADD COLUMN "token_hash"`** (sau khi `refresh_tokens` đã được drop ở các câu lệnh phía trên):

```sql
-- Session cũ không có token_hash; xoá sạch để mọi user đăng nhập lại (chấp nhận được ở môi trường dev).
DELETE FROM "user_sessions";
```

Kiểm tra file có chứa (thứ tự): `DROP TABLE "refresh_tokens"`, `DELETE FROM "user_sessions"`, `ADD COLUMN "token_hash"`, `DROP COLUMN "device_fingerprint"`.

- [ ] **Step 7: Apply migration + regenerate client**

Run: `cd api && npm run db:migrate:dev`
Expected: `Your database is now in sync with your schema.` và `Generated Prisma Client`.

- [ ] **Step 8: Commit**

```bash
cd api && git add prisma/schema.prisma prisma/migrations && git commit -m "feat(auth): drop RefreshToken + device_fingerprint, add UserSession.token_hash"
```

---

### Task 2: Rewrite `auth.constants.ts`

**Files:**
- Rewrite: `api/src/auth/auth.constants.ts`

- [ ] **Step 1: Thay toàn bộ nội dung** `api/src/auth/auth.constants.ts`:

```typescript
/**
 * Nguồn sự thật duy nhất cho mọi hằng số cấu hình của luồng auth session-cookie.
 */

const MS_PER_SECOND = 1000;

// ===== TTL session =====
/** Session sống 7 ngày; trượt (gia hạn) khi thời gian còn lại dưới ngưỡng renew. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Chỉ ghi DB gia hạn khi thời gian còn lại dưới 1 ngày — phần lớn request không ghi DB. */
export const SESSION_RENEW_THRESHOLD_SECONDS = 24 * 60 * 60;

export const SESSION_TTL_MS = SESSION_TTL_SECONDS * MS_PER_SECOND;
export const SESSION_RENEW_THRESHOLD_MS = SESSION_RENEW_THRESHOLD_SECONDS * MS_PER_SECOND;

// ===== Độ dài token ngẫu nhiên (bytes) =====
export const SESSION_TOKEN_BYTES = 32;

// ===== Cookie =====
export const SESSION_COOKIE_NAME = 'session_id';
export const DEVICE_COOKIE_NAME = 'device_id';
/** Cookie auth phải được gửi cho mọi route nên dùng path '/'. */
export const COOKIE_PATH = '/';
/** Device cookie sống dài (1 năm) để giữ định danh thiết bị qua nhiều phiên. */
export const DEVICE_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * MS_PER_SECOND;

// ===== Rate limit (áp ở AuthController) =====
export const AUTH_THROTTLE_TTL_MS = 60_000;
export const AUTH_THROTTLE_LIMIT = 10;

// ===== FE origin fallback khi thiếu env FRONTEND_ORIGIN =====
export const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';
```

- [ ] **Step 2: Commit** (build sẽ tạm đỏ tới hết Task 11 — bình thường cho refactor này)

```bash
cd api && git add src/auth/auth.constants.ts && git commit -m "refactor(auth): session-cookie constants, drop jwt/refresh constants"
```

---

### Task 3: Rewrite `token.service.ts`

**Files:**
- Rewrite: `api/src/auth/token.service.ts`

- [ ] **Step 1: Thay toàn bộ nội dung** `api/src/auth/token.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { SESSION_RENEW_THRESHOLD_MS, SESSION_TOKEN_BYTES, SESSION_TTL_MS } from './auth.constants';

@Injectable()
export class TokenService {
  /**
   * Input: Không nhận tham số.
   * Output: Cặp { raw, hash } cho session token — raw set vào cookie, hash lưu DB.
   */
  createSessionToken(): { raw: string; hash: string } {
    const raw = randomBytes(SESSION_TOKEN_BYTES).toString('hex');
    return { raw, hash: this.hashToken(raw) };
  }

  /**
   * Input: Chuỗi token raw.
   * Output: SHA-256 hex digest để tra/lưu DB.
   */
  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Input: Không nhận tham số.
   * Output: TTL session (ms) để dựng expires_at.
   */
  getSessionTtlMs(): number {
    return SESSION_TTL_MS;
  }

  /**
   * Input: Không nhận tham số.
   * Output: Ngưỡng (ms) còn lại để kích hoạt sliding renew.
   */
  getSessionRenewThresholdMs(): number {
    return SESSION_RENEW_THRESHOLD_MS;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd api && git add src/auth/token.service.ts && git commit -m "refactor(auth): TokenService chỉ sinh/băm session token"
```

---

### Task 4: Update `auth.utils.ts`

**Files:**
- Modify: `api/src/auth/auth.utils.ts`

- [ ] **Step 1: Thay toàn bộ nội dung** `api/src/auth/auth.utils.ts` (bỏ helper refresh-cookie + code redirect, thêm `isUuid`):

```typescript
import { DEFAULT_FRONTEND_ORIGIN } from './auth.constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Input: Giá trị bất kỳ từ cookie/param.
 * Output: true nếu là chuỗi UUID hợp lệ — chặn truy vấn Prisma bằng id rác.
 */
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Input: FRONTEND_ORIGIN từ env (có thể rỗng).
 * Output: URL callback FE cố định `/login/callback` (không còn kèm code).
 */
export function buildGoogleLoginCallbackRedirectUrl(frontendOrigin: string | undefined): string {
  const baseUrl = normalizeFrontendOrigin(frontendOrigin);
  return new URL('/login/callback', `${baseUrl}/`).toString();
}

/**
 * Input: FRONTEND_ORIGIN từ env (có thể rỗng).
 * Output: URL login FE cố định để fallback khi callback Google thất bại.
 */
export function buildGoogleLoginFailedRedirectUrl(frontendOrigin: string | undefined): string {
  const baseUrl = normalizeFrontendOrigin(frontendOrigin);
  return new URL('/login', `${baseUrl}/`).toString();
}

/**
 * Input: Header cookie thô và tên cookie cần đọc.
 * Output: Giá trị cookie (đã decode) nếu có, ngược lại null.
 */
export function readCookieValue(cookieHeader: string | undefined, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const pair of cookieHeader.split(';')) {
    const [name, ...valueParts] = pair.trim().split('=');
    if (name !== cookieName) {
      continue;
    }
    const rawValue = valueParts.join('=');
    if (!rawValue) {
      return null;
    }
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

/**
 * Input: Giá trị FE base URL từ env (có thể rỗng).
 * Output: Base URL đã loại bỏ dấu `/` cuối; fallback localhost nếu thiếu.
 */
function normalizeFrontendOrigin(frontendOrigin?: string): string {
  const rawBaseUrl = frontendOrigin?.trim() || DEFAULT_FRONTEND_ORIGIN;
  return rawBaseUrl.replace(/\/+$/, '');
}

/**
 * Input: Chuỗi User-Agent (có thể undefined).
 * Output: Tên platform (Windows/macOS/iOS/Android/Linux) hoặc null.
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

/**
 * Input: Chuỗi User-Agent (có thể undefined).
 * Output: Tên trình duyệt làm device name, hoặc null.
 */
export function parseDeviceNameFromUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) {
    return null;
  }
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/') || ua.includes('edga') || ua.includes('edgios')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('firefox') || ua.includes('fxios')) return 'Firefox';
  if (ua.includes('chrome') || ua.includes('crios')) return 'Chrome';
  if (ua.includes('safari')) return 'Safari';
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
cd api && git add src/auth/auth.utils.ts && git commit -m "refactor(auth): utils bỏ refresh-cookie/code, thêm isUuid"
```

---

### Task 5: Rewrite `device.service.ts`

**Files:**
- Rewrite: `api/src/auth/device.service.ts`

- [ ] **Step 1: Thay toàn bộ nội dung** `api/src/auth/device.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { isUuid, parseDeviceNameFromUserAgent, parsePlatformFromUserAgent } from './auth.utils';
import { PrismaTx } from './session.service';

@Injectable()
export class DeviceService {
  /**
   * Input: DatabaseService cho query đọc ngoài transaction.
   * Output: Service quản lý Device + DeviceUser.
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Input: deviceId từ cookie (có thể null/không hợp lệ), deviceName, userAgent, transaction client.
   * Output: Dùng lại Device nếu deviceId hợp lệ + tồn tại (cập nhật platform/name/last_seen);
   *         ngược lại tạo Device mới. Trả device để caller set lại cookie device_id.
   */
  async ensureDevice(
    params: { deviceId?: string | null; deviceName?: string | null; userAgent?: string },
    tx: PrismaTx,
  ) {
    const platform = parsePlatformFromUserAgent(params.userAgent);
    const deviceName = params.deviceName ?? parseDeviceNameFromUserAgent(params.userAgent);
    const now = new Date();
    if (isUuid(params.deviceId)) {
      const existing = await tx.device.findUnique({ where: { id: params.deviceId } });
      if (existing) {
        return tx.device.update({
          where: { id: existing.id },
          data: {
            ...(deviceName ? { device_name: deviceName } : {}),
            ...(platform ? { platform } : {}),
            last_seen_at: now,
          },
        });
      }
    }
    return tx.device.create({
      data: { device_name: deviceName, platform, last_seen_at: now },
    });
  }

  /**
   * Input: deviceId, userId, transaction client.
   * Output: Link account vào device (upsert), KHÔNG deactivate account khác — cho phép multi-account.
   */
  async linkDeviceUser(params: { deviceId: string; userId: string }, tx: PrismaTx): Promise<void> {
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

- [ ] **Step 2: Commit**

```bash
cd api && git add src/auth/device.service.ts && git commit -m "refactor(auth): DeviceService định danh device bằng cookie id"
```

---

### Task 6: Rewrite `session.service.ts` (TDD)

**Files:**
- Rewrite: `api/src/auth/session.service.ts`
- Test (tạm, xoá sau): `api/src/auth/session.service.spec.ts`

- [ ] **Step 1: Viết test thất bại** — tạo `api/src/auth/session.service.spec.ts`:

```typescript
import { SessionService } from './session.service';

// Mock TokenService: token cố định để assert; ttl 7 ngày, ngưỡng renew 1 ngày.
const tokenService = {
  createSessionToken: () => ({ raw: 'RAW', hash: 'HASH' }),
  hashToken: (raw: string) => `hash:${raw}`,
  getSessionTtlMs: () => 7 * 24 * 60 * 60 * 1000,
  getSessionRenewThresholdMs: () => 24 * 60 * 60 * 1000,
} as any;

function makeDb(overrides: any = {}) {
  return {
    userSession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'sess-new' }),
      findMany: jest.fn(),
      ...overrides.userSession,
    },
    deviceUser: { findUnique: jest.fn(), ...overrides.deviceUser },
  } as any;
}

describe('SessionService.validateSession', () => {
  it('ném AUTH_001 khi không tìm thấy session', async () => {
    const db = makeDb();
    db.userSession.findUnique.mockResolvedValue(null);
    const svc = new SessionService(db, tokenService);
    await expect(svc.validateSession('RAW', 'dev-1')).rejects.toMatchObject({ code: 'AUTH_001' });
  });

  it('ném AUTH_001 khi device_id không khớp', async () => {
    const db = makeDb();
    db.userSession.findUnique.mockResolvedValue({
      id: 's1', user_id: 'u1', device_id: 'OTHER', is_revoked: false,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000), user: { email: 'a@b.c' },
    });
    const svc = new SessionService(db, tokenService);
    await expect(svc.validateSession('RAW', 'dev-1')).rejects.toMatchObject({ code: 'AUTH_001' });
  });

  it('hợp lệ + còn xa hạn → KHÔNG renew (không gọi update)', async () => {
    const db = makeDb();
    db.userSession.findUnique.mockResolvedValue({
      id: 's1', user_id: 'u1', device_id: 'dev-1', is_revoked: false,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000), user: { email: 'a@b.c' },
    });
    const svc = new SessionService(db, tokenService);
    const res = await svc.validateSession('RAW', 'dev-1');
    expect(res).toEqual({ userId: 'u1', email: 'a@b.c', sessionId: 's1' });
    expect(db.userSession.update).not.toHaveBeenCalled();
  });

  it('hợp lệ + gần hạn (<1 ngày) → renew (gọi update)', async () => {
    const db = makeDb();
    db.userSession.findUnique.mockResolvedValue({
      id: 's1', user_id: 'u1', device_id: 'dev-1', is_revoked: false,
      expires_at: new Date(Date.now() + 3600 * 1000), user: { email: 'a@b.c' },
    });
    const svc = new SessionService(db, tokenService);
    await svc.validateSession('RAW', 'dev-1');
    expect(db.userSession.update).toHaveBeenCalledTimes(1);
  });
});

describe('SessionService.switchActiveSession', () => {
  const tx = () => makeDb();

  it('ném AUTH_001 khi account chưa link device', async () => {
    const db = tx();
    db.deviceUser.findUnique.mockResolvedValue(null);
    const svc = new SessionService(db, tokenService);
    await expect(svc.switchActiveSession({ deviceId: 'dev-1', userId: 'u1' }, db)).rejects.toMatchObject({ code: 'AUTH_001' });
  });

  it('ném AUTH_001 khi không còn phiên sống', async () => {
    const db = tx();
    db.deviceUser.findUnique.mockResolvedValue({ id: 'l1' });
    db.userSession.findFirst.mockResolvedValue(null);
    const svc = new SessionService(db, tokenService);
    await expect(svc.switchActiveSession({ deviceId: 'dev-1', userId: 'u1' }, db)).rejects.toMatchObject({ code: 'AUTH_001' });
  });

  it('cấp token mới khi còn phiên sống', async () => {
    const db = tx();
    db.deviceUser.findUnique.mockResolvedValue({ id: 'l1' });
    db.userSession.findFirst.mockResolvedValue({ id: 's1' });
    const svc = new SessionService(db, tokenService);
    const raw = await svc.switchActiveSession({ deviceId: 'dev-1', userId: 'u1' }, db);
    expect(raw).toBe('RAW');
    expect(db.userSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' }, data: expect.objectContaining({ token_hash: 'HASH' }) }),
    );
  });
});
```

- [ ] **Step 2: Chạy test → fail**

Run: `cd api && npx jest src/auth/session.service.spec.ts`
Expected: FAIL (các method `validateSession`/`switchActiveSession` chưa khớp / SessionService cũ tham chiếu `refreshToken` không build được).

- [ ] **Step 3: Thay toàn bộ nội dung** `api/src/auth/session.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '../generated/prisma/client';
import { TokenService } from './token.service';

export type PrismaTx = Prisma.TransactionClient;

type RevokeReason = 'logout' | 'revoked_remote';

@Injectable()
export class SessionService {
  /**
   * Input: DatabaseService (query ngoài transaction), TokenService (sinh/băm token).
   * Output: Service quản lý vòng đời UserSession (không còn RefreshToken).
   */
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Input: userId, deviceId, transaction client.
   * Output: Tạo session mới với token_hash + expires_at = now + TTL; trả { sessionId, sessionTokenRaw }.
   */
  async createSession(
    params: { userId: string; deviceId: string },
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
    return { sessionId: session.id, sessionTokenRaw: raw };
  }

  /**
   * Input: userId, deviceId, transaction client.
   * Output: Login/add-account — có phiên sống thì cấp token mới cho phiên đó, chưa có thì tạo mới. Trả raw token.
   */
  async createOrRefreshSession(params: { userId: string; deviceId: string }, tx: PrismaTx): Promise<string> {
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
      return raw;
    }
    const created = await this.createSession(params, tx);
    return created.sessionTokenRaw;
  }

  /**
   * Input: raw session token từ cookie + deviceId từ cookie.
   * Output: { userId, email, sessionId } nếu hợp lệ. Sai/khác device/revoked/hết hạn → AUTH_001.
   *         Sliding renew: chỉ ghi DB khi thời gian còn lại dưới ngưỡng (mặc định <1 ngày).
   */
  async validateSession(
    rawToken: string,
    deviceId: string,
  ): Promise<{ userId: string; email: string; sessionId: string }> {
    const hash = this.tokenService.hashToken(rawToken);
    const session = await this.databaseService.userSession.findUnique({
      where: { token_hash: hash },
      include: { user: true },
    });
    const now = Date.now();
    if (!session || session.device_id !== deviceId || session.is_revoked || session.expires_at.getTime() <= now) {
      throw new AppException(ERROR_CODES.AUTH_001);
    }
    if (session.expires_at.getTime() - now < this.tokenService.getSessionRenewThresholdMs()) {
      await this.databaseService.userSession.update({
        where: { id: session.id },
        data: { last_used_at: new Date(), expires_at: new Date(now + this.tokenService.getSessionTtlMs()) },
      });
    }
    return { userId: session.user_id, email: session.user.email, sessionId: session.id };
  }

  /**
   * Input: deviceId (từ cookie), userId đích, transaction client.
   * Output: Account đã link + còn phiên sống → cấp token mới cho phiên đó, trả raw. Ngược lại AUTH_001 (cần login lại).
   */
  async switchActiveSession(params: { deviceId: string; userId: string }, tx: PrismaTx): Promise<string> {
    const link = await tx.deviceUser.findUnique({
      where: { device_id_user_id: { device_id: params.deviceId, user_id: params.userId } },
    });
    if (!link) throw new AppException(ERROR_CODES.AUTH_001);
    const session = await tx.userSession.findFirst({
      where: { user_id: params.userId, device_id: params.deviceId, is_revoked: false, expires_at: { gt: new Date() } },
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
    return raw;
  }

  /**
   * Input: raw session token, transaction client.
   * Output: Revoke session sở hữu token (reason 'logout'). Bỏ qua nếu không khớp.
   */
  async revokeByRawToken(rawToken: string, tx: PrismaTx): Promise<void> {
    const hash = this.tokenService.hashToken(rawToken);
    const session = await tx.userSession.findUnique({ where: { token_hash: hash } });
    if (!session) return;
    await this.revokeSession(session.id, 'logout', tx);
  }

  /**
   * Input: sessionId, userId chủ sở hữu, transaction client.
   * Output: Revoke session (reason 'revoked_remote') nếu thuộc user; AUTH_001 nếu không sở hữu.
   */
  async revokeSessionOwnedByUser(sessionId: string, userId: string, tx: PrismaTx): Promise<void> {
    const session = await tx.userSession.findFirst({ where: { id: sessionId, user_id: userId } });
    if (!session) throw new AppException(ERROR_CODES.AUTH_001);
    await this.revokeSession(sessionId, 'revoked_remote', tx);
  }

  /**
   * Input: userId.
   * Output: Danh sách session sống kèm device cho màn "thiết bị đang đăng nhập".
   */
  async listByUser(userId: string) {
    return this.databaseService.userSession.findMany({
      where: { user_id: userId, is_revoked: false, expires_at: { gt: new Date() } },
      include: { device: true },
      orderBy: { last_used_at: 'desc' },
    });
  }

  /**
   * Input: deviceId.
   * Output: user_id (distinct) của các account còn phiên sống trên device — để đánh dấu account cần login lại.
   */
  async listLiveUserIdsForDevice(deviceId: string): Promise<string[]> {
    const sessions = await this.databaseService.userSession.findMany({
      where: { device_id: deviceId, is_revoked: false, expires_at: { gt: new Date() } },
      select: { user_id: true },
    });
    return [...new Set(sessions.map((s) => s.user_id))];
  }

  /**
   * Input: sessionId, lý do revoke, transaction client.
   * Output: Đánh dấu session revoked.
   */
  private async revokeSession(sessionId: string, reason: RevokeReason, tx: PrismaTx): Promise<void> {
    await tx.userSession.update({
      where: { id: sessionId },
      data: { is_revoked: true, revoked_at: new Date(), revoke_reason: reason },
    });
  }
}
```

- [ ] **Step 4: Chạy test → pass**

Run: `cd api && npx jest src/auth/session.service.spec.ts`
Expected: PASS toàn bộ.

- [ ] **Step 5: Xoá spec (quy ước repo) rồi commit code**

```bash
cd api && rm src/auth/session.service.spec.ts && git add src/auth/session.service.ts && git commit -m "refactor(auth): SessionService session-cookie (bỏ refresh token rotation)"
```

---

### Task 7: Tạo `SessionGuard`, xoá `AccessTokenGuard`

**Files:**
- Create: `api/src/common/guards/session.guard.ts`
- Delete: `api/src/common/guards/access-token.guard.ts`

- [ ] **Step 1: Tạo** `api/src/common/guards/session.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';
import { DEVICE_COOKIE_NAME, SESSION_COOKIE_NAME } from '../../auth/auth.constants';
import { isUuid, readCookieValue } from '../../auth/auth.utils';
import { SessionService } from '../../auth/session.service';

@Injectable()
export class SessionGuard implements CanActivate {
  /**
   * Input: SessionService để xác thực session cookie.
   * Output: Guard chặn request thiếu/không hợp lệ session cookie.
   */
  constructor(private readonly sessionService: SessionService) {}

  /**
   * Input: ExecutionContext của request HTTP.
   * Output: true nếu cookie session_id + device_id hợp lệ (gán req.userId/req.userEmail); ném AUTH_001 nếu không.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; userEmail?: string }>();
    const sessionToken = readCookieValue(request.headers.cookie, SESSION_COOKIE_NAME);
    const deviceId = readCookieValue(request.headers.cookie, DEVICE_COOKIE_NAME);
    if (!sessionToken || !isUuid(deviceId)) {
      throw new AppException(ERROR_CODES.AUTH_001);
    }
    const result = await this.sessionService.validateSession(sessionToken, deviceId);
    request.userId = result.userId;
    request.userEmail = result.email;
    return true;
  }
}
```

- [ ] **Step 2: Xoá guard cũ**

Run: `cd api && rm src/common/guards/access-token.guard.ts`

- [ ] **Step 3: Commit**

```bash
cd api && git add src/common/guards/ && git commit -m "feat(auth): SessionGuard thay AccessTokenGuard"
```

---

### Task 8: DTOs — thêm switch, xoá DTO cũ

**Files:**
- Create: `api/src/auth/dto/switch-account.dto.ts`
- Delete: `api/src/auth/dto/{exchange-google-code,refresh,logout}.dto.ts`

- [ ] **Step 1: Tạo** `api/src/auth/dto/switch-account.dto.ts`:

```typescript
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SwitchAccountDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  userId!: string;
}
```

- [ ] **Step 2: Xoá DTO cũ**

Run: `cd api && rm src/auth/dto/exchange-google-code.dto.ts src/auth/dto/refresh.dto.ts src/auth/dto/logout.dto.ts`

- [ ] **Step 3: Commit**

```bash
cd api && git add src/auth/dto/ && git commit -m "feat(auth): SwitchAccountDto, xoá DTO exchange/refresh/logout"
```

---

### Task 9: Rewrite `auth.service.ts`

**Files:**
- Rewrite: `api/src/auth/auth.service.ts`

- [ ] **Step 1: Thay toàn bộ nội dung** `api/src/auth/auth.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleUser } from '../common/utils/types';
import { DatabaseService } from '../database/database.service';
import { DeviceService } from './device.service';
import { SessionService } from './session.service';

type LoginContext = { deviceId?: string | null; deviceName?: string; userAgent?: string };
type LoginResult = { userId: string; sessionTokenRaw: string; deviceId: string; user: GoogleUser };

@Injectable()
export class AuthService {
  /**
   * Input: DatabaseService, SessionService, DeviceService.
   * Output: Service orchestrate nghiệp vụ login/switch/logout/quản lý phiên.
   */
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly sessionService: SessionService,
    private readonly deviceService: DeviceService,
  ) {}

  /**
   * Input: Google profile đã validate + ngữ cảnh (deviceId cookie, userAgent).
   * Output: Upsert user, đảm bảo Device, link DeviceUser, tạo/refresh session. Trả raw token + deviceId để set cookie.
   */
  async loginWithGoogle(googleUser: GoogleUser, ctx: LoginContext): Promise<LoginResult> {
    const user = await this.upsertGoogleUser(googleUser);
    const result = await this.databaseService.$transaction(async (tx) => {
      const device = await this.deviceService.ensureDevice(
        { deviceId: ctx.deviceId, deviceName: ctx.deviceName, userAgent: ctx.userAgent },
        tx,
      );
      await this.deviceService.linkDeviceUser({ deviceId: device.id, userId: user.id }, tx);
      const sessionTokenRaw = await this.sessionService.createOrRefreshSession(
        { userId: user.id, deviceId: device.id },
        tx,
      );
      return { deviceId: device.id, sessionTokenRaw };
    });
    return {
      userId: user.id,
      sessionTokenRaw: result.sessionTokenRaw,
      deviceId: result.deviceId,
      user: this.toGoogleUser(user),
    };
  }

  /**
   * Input: deviceId (từ cookie) + userId đích.
   * Output: raw token mới cho account đích nếu còn phiên sống; AUTH_001 nếu cần login lại.
   */
  async switchAccount(deviceId: string, userId: string): Promise<{ userId: string; sessionTokenRaw: string }> {
    const sessionTokenRaw = await this.databaseService.$transaction((tx) =>
      this.sessionService.switchActiveSession({ deviceId, userId }, tx),
    );
    return { userId, sessionTokenRaw };
  }

  /**
   * Input: raw session token.
   * Output: Revoke session hiện tại (logout). Không ném lỗi nếu token đã không hợp lệ.
   */
  async logout(rawToken: string): Promise<void> {
    await this.databaseService.$transaction((tx) => this.sessionService.revokeByRawToken(rawToken, tx));
  }

  /**
   * Input: deviceId từ cookie.
   * Output: Danh sách account trên device + cờ needsRelogin (account hết phiên sống).
   */
  async listAccounts(deviceId: string) {
    const [links, liveUserIds] = await Promise.all([
      this.deviceService.listAccountsByDevice(deviceId),
      this.sessionService.listLiveUserIdsForDevice(deviceId),
    ]);
    const live = new Set(liveUserIds);
    return {
      accounts: links.map((l) => ({
        userId: l.user.id,
        email: l.user.email,
        fullName: l.user.full_name,
        avatarUrl: l.user.avatar_url,
        needsRelogin: !live.has(l.user.id),
      })),
    };
  }

  /**
   * Input: userId từ SessionGuard.
   * Output: Thông tin user hiện tại.
   */
  async getMe(userId: string) {
    const user = await this.databaseService.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(ERROR_CODES.AUTH_001);
    return { userId: user.id, user: this.toGoogleUser(user) };
  }

  /**
   * Input: userId từ SessionGuard.
   * Output: Danh sách thiết bị/phiên của user.
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
    await this.databaseService.$transaction((tx) =>
      this.sessionService.revokeSessionOwnedByUser(sessionId, userId, tx),
    );
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
   * Input: Google user đã validate.
   * Output: Upsert bản ghi users theo provider_user_id; trả user mới nhất.
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
}
```

- [ ] **Step 2: Commit**

```bash
cd api && git add src/auth/auth.service.ts && git commit -m "refactor(auth): AuthService login/switch/logout theo session cookie"
```

---

### Task 10: Rewrite `auth.controller.ts`

**Files:**
- Rewrite: `api/src/auth/auth.controller.ts`

- [ ] **Step 1: Thay toàn bộ nội dung** `api/src/auth/auth.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, Logger, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { GoogleAuthGuard } from '../common/guards/google-auth.guard';
import { SessionGuard } from '../common/guards/session.guard';
import { isProductionEnvironment } from '../common/utils/functions';
import { AuthService } from './auth.service';
import { SwitchAccountDto } from './dto/switch-account.dto';
import {
  buildGoogleLoginCallbackRedirectUrl,
  buildGoogleLoginFailedRedirectUrl,
  readCookieValue,
} from './auth.utils';
import {
  AUTH_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_MS,
  COOKIE_PATH,
  DEVICE_COOKIE_MAX_AGE_MS,
  DEVICE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from './auth.constants';

@Throttle({ global: { ttl: AUTH_THROTTLE_TTL_MS, limit: AUTH_THROTTLE_LIMIT } })
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  /**
   * Input: AuthService (nghiệp vụ) + ConfigService (FRONTEND_ORIGIN, môi trường).
   * Output: Controller cho các route xác thực.
   */
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Input: Request khởi tạo OAuth.
   * Output: Chuyển hướng sang trang đăng nhập Google.
   */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  loginWithGoogle(): void {}

  /**
   * Input: Callback Google (profile đã validate) + cookie device_id (nếu có).
   * Output: Tạo session, set cookie session_id + device_id, redirect thẳng về FE `/login/callback`.
   */
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() request: Request, @Res() response: Response): Promise<void> {
    const frontendOrigin = this.configService.get<string>('FRONTEND_ORIGIN');
    const loginPageUrl = buildGoogleLoginFailedRedirectUrl(frontendOrigin);
    try {
      const googleUser = request.user;
      if (!googleUser) {
        this.logger.warn('Google callback received without user profile, redirecting to login');
        response.redirect(302, loginPageUrl);
        return;
      }
      const deviceId = readCookieValue(request.headers.cookie, DEVICE_COOKIE_NAME);
      const result = await this.authService.loginWithGoogle(googleUser, {
        deviceId,
        userAgent: request.headers['user-agent'],
      });
      response.cookie(SESSION_COOKIE_NAME, result.sessionTokenRaw, this.buildCookieOptions(SESSION_TTL_MS));
      response.cookie(DEVICE_COOKIE_NAME, result.deviceId, this.buildCookieOptions(DEVICE_COOKIE_MAX_AGE_MS));
      this.logger.log(`Session issued for ${googleUser.email}, redirecting to FE callback`);
      response.redirect(302, buildGoogleLoginCallbackRedirectUrl(frontendOrigin));
    } catch (err) {
      this.logger.error(`Google callback failed: ${err instanceof Error ? err.message : String(err)}`);
      response.redirect(302, loginPageUrl);
    }
  }

  /**
   * Input: body.userId + cookie device_id.
   * Output: Đổi account active — set lại cookie session_id. AUTH_001 nếu account cần login lại.
   */
  @Post('switch')
  async switchAccount(
    @Body() body: SwitchAccountDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const deviceId = readCookieValue(request.headers.cookie, DEVICE_COOKIE_NAME);
    if (!deviceId) throw new AppException(ERROR_CODES.AUTH_001);
    const result = await this.authService.switchAccount(deviceId, body.userId);
    response.cookie(SESSION_COOKIE_NAME, result.sessionTokenRaw, this.buildCookieOptions(SESSION_TTL_MS));
    return { success: true, userId: result.userId };
  }

  /**
   * Input: cookie session_id.
   * Output: Revoke session hiện tại + xoá cookie session_id (giữ device_id).
   */
  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = readCookieValue(request.headers.cookie, SESSION_COOKIE_NAME);
    if (rawToken) await this.authService.logout(rawToken);
    response.clearCookie(SESSION_COOKIE_NAME, this.buildCookieOptions(SESSION_TTL_MS));
    return { success: true };
  }

  /**
   * Input: cookie device_id.
   * Output: Danh sách account trên device + cờ needsRelogin (rỗng nếu chưa có device_id).
   */
  @Get('accounts')
  async accounts(@Req() request: Request) {
    const deviceId = readCookieValue(request.headers.cookie, DEVICE_COOKIE_NAME);
    if (!deviceId) return { accounts: [] };
    return this.authService.listAccounts(deviceId);
  }

  /**
   * Input: session cookie (qua SessionGuard).
   * Output: Thông tin user hiện tại.
   */
  @Get('me')
  @UseGuards(SessionGuard)
  async me(@Req() request: Request & { userId: string }) {
    return this.authService.getMe(request.userId);
  }

  /**
   * Input: session cookie (qua SessionGuard).
   * Output: Danh sách thiết bị/phiên của user.
   */
  @Get('devices')
  @UseGuards(SessionGuard)
  async devices(@Req() request: Request & { userId: string }) {
    return this.authService.listDevices(request.userId);
  }

  /**
   * Input: session cookie (qua SessionGuard) + sessionId.
   * Output: Revoke session từ xa nếu thuộc về user.
   */
  @Delete('sessions/:id')
  @UseGuards(SessionGuard)
  async revokeSession(@Param('id') id: string, @Req() request: Request & { userId: string }) {
    await this.authService.revokeSession(id, request.userId);
    return { success: true };
  }

  private buildCookieOptions(maxAge: number) {
    return {
      httpOnly: true,
      secure: isProductionEnvironment(this.configService),
      sameSite: 'lax' as const,
      path: COOKIE_PATH,
      maxAge,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd api && git add src/auth/auth.controller.ts && git commit -m "refactor(auth): controller set session cookie + redirect, thêm /auth/switch"
```

---

### Task 11: Wiring module + build/lint xanh

**Files:**
- Modify (nếu cần): `api/src/auth/auth.module.ts`

- [ ] **Step 1: Kiểm tra `auth.module.ts`** — providers hiện tại: `AuthService, GoogleStrategy, TokenService, SessionService, DeviceService`. Giữ nguyên (tất cả vẫn dùng). Không cần thêm `SessionGuard` vào providers (Nest tự khởi tạo class guard, deps `SessionService` đã có trong module). Mở file xác nhận khớp:

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
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
  providers: [AuthService, GoogleStrategy, TokenService, SessionService, DeviceService],
})
export class AuthModule {}
```

- [ ] **Step 2: Grep tham chiếu cũ còn sót** — phải KHÔNG ra kết quả nào (trừ trong docs/):

Run:
```bash
cd api && grep -rnE "AccessTokenGuard|createAccessToken|verifyAccessToken|RefreshToken|refreshToken|rt_|REFRESH_COOKIE|google/exchange|accounts/status|exchangeGoogleLoginCode|ExchangeGoogleCodeDto|RefreshDto|LogoutDto|JWT_SECRET|CACHE_AUTH_CODE" src/
```
Expected: không có dòng nào. Nếu còn, sửa file đó cho khớp API mới (vd import guard cũ, type cũ).

- [ ] **Step 3: Type-check + build**

Run: `cd api && npm run build`
Expected: build thành công, không lỗi TS.

- [ ] **Step 4: Lint**

Run: `cd api && npm run lint`
Expected: không lỗi.

- [ ] **Step 5: Commit** (nếu có sửa)

```bash
cd api && git add -A && git commit -m "chore(auth): dọn tham chiếu cũ, build xanh" || echo "nothing to commit"
```

---

### Task 12: Verification thủ công (chạy app + OAuth thật)

**Files:** không sửa code.

- [ ] **Step 1: Khởi động API**

Run: `cd api && npm run dev` (chạy nền/terminal riêng). Đảm bảo Postgres + biến env `GOOGLE_CLIENT_ID/SECRET`, `API_URL`, `FRONTEND_ORIGIN` đã set.
Expected: app khởi động, không lỗi DI.

- [ ] **Step 2: Login Google** — mở trình duyệt `GET <API_URL>/auth/google`, đăng nhập.
Expected: redirect về `<FRONTEND_ORIGIN>/login/callback` (không có `?code=`); DevTools → Application → Cookies có `session_id` + `device_id` (httpOnly). DB: 1 row `devices`, 1 row `device_users`, 1 row `user_sessions` có `token_hash`, 0 row `refresh_tokens` (bảng đã bị drop).

- [ ] **Step 3: Gọi `/auth/me`** — với cookie sẵn có:

Run: `curl -i --cookie "session_id=<raw>; device_id=<uuid>" <API_URL>/auth/me`
(lấy `<raw>`/`<uuid>` từ cookie trình duyệt). Expected: 200 + `{ userId, user: {...} }`.

- [ ] **Step 4: Cookie sai → 401**

Run: `curl -i --cookie "session_id=khongdung; device_id=<uuid>" <API_URL>/auth/me`
Expected: 401, body chứa `AUTH_001`.

- [ ] **Step 5: Add account thứ 2** — `GET /auth/google` lần nữa, chọn account khác (Google hiện chọn account). Expected: `device_users` có 2 rows cùng `device_id`; `user_sessions` có session cho account 2; cookie `session_id` đổi sang account 2; `device_id` giữ nguyên.

- [ ] **Step 6: `/auth/accounts`**

Run: `curl -s --cookie "device_id=<uuid>" <API_URL>/auth/accounts`
Expected: `{ accounts: [ {userId, email, needsRelogin:false}, ... ] }` đủ 2 account.

- [ ] **Step 7: Switch account**

Run: `curl -i --cookie "device_id=<uuid>" -H "Content-Type: application/json" -d '{"userId":"<account1_id>"}' <API_URL>/auth/switch`
Expected: 200 `{ success:true, userId }`, header `Set-Cookie: session_id=...`. Gọi `/auth/me` với cookie mới → trả account1.

- [ ] **Step 8: Logout**

Run: `curl -i --cookie "session_id=<raw>; device_id=<uuid>" -X POST <API_URL>/auth/logout`
Expected: 200, `Set-Cookie` xoá `session_id`; DB session đó `is_revoked=true`, `revoke_reason='logout'`. `/auth/me` với token đã logout → 401.

- [ ] **Step 9: Dừng app.** Báo cáo kết quả từng bước (pass/fail kèm output). Nếu có bước fail → dùng `superpowers:systematic-debugging` trước khi coi là xong.

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** 2 cookie (Task 1,2,10) ✓ · bỏ RefreshToken/JWT/refresh (Task 1,3,9,10) ✓ · UserSession.token_hash (Task 1,6) ✓ · bỏ device_fingerprint (Task 1,5) ✓ · callback set cookie + redirect, bỏ code/change/exchange (Task 9,10) ✓ · SessionGuard (Task 7) ✓ · sliding renew <1 ngày (Task 6) ✓ · multi-account + /auth/switch + bắt login lại khi hết hạn (Task 6,9,10) ✓ · /auth/accounts kèm needsRelogin (Task 9,10) ✓ · giữ /me,/devices,/sessions/:id (Task 10) ✓ · testing + verify (Task 6,12) ✓.
- **Type consistency:** `createSessionToken/hashToken/getSessionTtlMs/getSessionRenewThresholdMs` (TokenService) khớp giữa Task 3 và 6. `validateSession→{userId,email,sessionId}`, `switchActiveSession→string`, `createOrRefreshSession→string`, `ensureDevice→device`, `listLiveUserIdsForDevice→string[]` khớp giữa service (Task 5,6) và consumer (Task 7,9). Cookie hằng số (`SESSION_COOKIE_NAME/DEVICE_COOKIE_NAME/COOKIE_PATH/SESSION_TTL_MS/DEVICE_COOKIE_MAX_AGE_MS`) khớp giữa Task 2 và 7,10.
- **Phạm vi:** Chỉ backend (Phase 1). Frontend (`ui/`) tách plan riêng — Task 12 verify bằng curl, không cần FE.
