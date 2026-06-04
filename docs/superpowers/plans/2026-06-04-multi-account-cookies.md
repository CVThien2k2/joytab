# Multi-Account (Multi-Cookie) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép đăng nhập nhiều account đồng thời trên cùng browser (kiểu Gmail), mỗi account giữ refresh token riêng trong 1 cookie httpOnly, đổi account tức thì phía client mà không cần roundtrip.

**Architecture:** Access token (Bearer, trong memory client) là cái "chọn account" cho mọi request nghiệp vụ. Refresh token mỗi account nằm trong 1 cookie httpOnly riêng tên `rt_<accountId>` (path `/auth`), chỉ dùng khi refresh/logout. Tầng `UserSession`/`RefreshToken` + quản lý thiết bị giữ nguyên; bỏ ràng buộc "1 active/device". Endpoint `/auth/switch` bị loại bỏ — switch là việc của client (đổi access token đang dùng).

**Tech Stack:** NestJS + Prisma (PostgreSQL) ở `api/`; Next.js 16 + React 19 + Zustand + React Query + axios ở `ui/`.

**Lưu ý môi trường:** `ui/` hiện KHÔNG có test runner; `api/` có jest nhưng đã xoá hết spec. Vì vậy mỗi task verify bằng `tsc --noEmit`, `next build`, và boot Nest (đọc log map route + DI), thay cho unit test. Nếu muốn TDD, thêm lại jest ở api trước (ngoài phạm vi plan này).

**Quy ước:** `accountId` = `user.id` nội bộ (UUID) = `sub` của JWT access token. Tên cookie refresh: `rt_<accountId>`.

---

## File Structure

**Backend (`api/`):**
- `prisma/schema.prisma` — bỏ partial unique `@@unique([device_id], where: { is_active: true })` trên `device_users`.
- `src/auth/auth.utils.ts` — thêm helper tên cookie `buildRefreshCookieName(accountId)`; giữ `REFRESH_TOKEN_COOKIE_PATH`, `REFRESH_TOKEN_TTL_MS`.
- `src/auth/dto/refresh.dto.ts` (mới) — `{ accountId }`.
- `src/auth/dto/logout.dto.ts` (mới) — `{ accountId }`.
- `src/auth/auth.service.ts` — `exchangeGoogleLoginCode` trả thêm `userId`, KHÔNG revoke account khác; `refresh(accountId, rawToken)`; `logout(accountId, rawToken)`; bỏ `switchAccount`.
- `src/auth/device.service.ts` — `linkDeviceUser` (chỉ link, không deactivate account khác).
- `src/auth/session.service.ts` — giữ nguyên; bỏ dùng `revokeOrphanTokenKeepSession` trong exchange.
- `src/auth/auth.controller.ts` — `exchange` set cookie `rt_<userId>`; `refresh`/`logout` đọc `accountId` + cookie tương ứng; xoá route `switch`.

**Frontend (`ui/`):**
- `src/stores/auth-store.ts` — viết lại: `accounts` map + `activeAccountId` (per-tab).
- `src/lib/auth-callback.ts` — schema thêm `userId`.
- `src/lib/auth-api.ts` — `refreshAccount(accountId)`, `logoutAccount(accountId)`; bỏ `switchAccount`.
- `src/lib/api-client.ts` — gắn access token của active account; 401 → refresh theo active accountId.
- `src/hooks/use-auth-api.ts` — `useAccounts`, `useDevices`, `useRevokeSession`, `useLogout(accountId)`; bỏ `useSwitchAccount`.
- `src/hooks/use-restore-accounts.ts` (mới) — lúc load app, refresh active account để lấy access token.
- `src/app/(private)/home-page-client.tsx` — account switcher (đổi active tức thì) + "Thêm tài khoản".
- `src/app/(auth)/login/callback/callback-client.tsx` — sau exchange: `addAccount` + `setActive`.

---

## Phase 0 — DB migration

### Task 0: Bỏ ràng buộc 1-active/device

**Files:**
- Modify: `api/prisma/schema.prisma` (model `DeviceUser`)

- [ ] **Step 1: Xoá dòng partial unique constraint**

Trong `model DeviceUser`, xoá dòng:
```prisma
  @@unique([device_id], where: { is_active: true })
```
Giữ `@@unique([device_id, user_id])`. Cột `is_active` giữ lại (không còn ràng buộc, dùng cho UI "đang xem gần nhất" nếu cần) nhưng không bắt buộc.

- [ ] **Step 2: Tạo migration**

Run: `cd api && pnpm db:migrate:dev --name drop_single_active_device_user`
Expected: migration tạo + áp dụng, `prisma generate` chạy lại, không lỗi.

- [ ] **Step 3: Commit**

```bash
git add api/prisma
git commit -m "feat(db): allow multiple active accounts per device"
```

---

## Phase 1 — Backend multi-cookie

### Task 1: Helper tên cookie refresh theo account

**Files:**
- Modify: `api/src/auth/auth.utils.ts`

- [ ] **Step 1: Thêm helper**

Thêm vào cuối `auth.utils.ts`:
```ts
/**
 * Input: accountId (user.id nội bộ).
 * Output: Tên cookie refresh token riêng cho account đó, vd 'rt_<uuid>'.
 */
export function buildRefreshCookieName(accountId: string): string {
  return `rt_${accountId}`;
}
```

- [ ] **Step 2: Verify compile**

Run: `cd api && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/src/auth/auth.utils.ts
git commit -m "feat(auth): per-account refresh cookie name helper"
```

### Task 2: DTO cho refresh & logout

**Files:**
- Create: `api/src/auth/dto/refresh.dto.ts`
- Create: `api/src/auth/dto/logout.dto.ts`

- [ ] **Step 1: Viết refresh.dto.ts**

```ts
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  accountId!: string;
}
```

- [ ] **Step 2: Viết logout.dto.ts**

```ts
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  accountId!: string;
}
```

- [ ] **Step 3: Verify compile**

Run: `cd api && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add api/src/auth/dto/refresh.dto.ts api/src/auth/dto/logout.dto.ts
git commit -m "feat(auth): refresh/logout dto with accountId"
```

### Task 3: DeviceService — link không deactivate account khác

**Files:**
- Modify: `api/src/auth/device.service.ts` (`activateDeviceUser` → `linkDeviceUser`)

- [ ] **Step 1: Thay `activateDeviceUser` bằng `linkDeviceUser`**

```ts
  /**
   * Input: deviceId, userId và transaction client.
   * Output: Link account vào device (upsert), KHÔNG deactivate account khác — cho phép nhiều account song song.
   */
  async linkDeviceUser(params: { deviceId: string; userId: string }, tx: PrismaTx): Promise<void> {
    await tx.deviceUser.upsert({
      where: { device_id_user_id: { device_id: params.deviceId, user_id: params.userId } },
      create: { device_id: params.deviceId, user_id: params.userId, is_active: true },
      update: { is_active: true },
    });
  }
```
Xoá method `activateDeviceUser` cũ (đoạn `updateMany ... is_active: false` không còn cần).

- [ ] **Step 2: Verify compile (sẽ lỗi ở chỗ gọi cũ — sửa ở Task 4/5)**

Run: `cd api && npx tsc --noEmit`
Expected: chỉ còn lỗi "activateDeviceUser does not exist" tại `auth.service.ts` (sẽ sửa Task 4). Ghi nhận, qua bước sau.

### Task 4: AuthService.exchange — trả userId, set nhiều cookie, không revoke account khác

**Files:**
- Modify: `api/src/auth/auth.service.ts`

- [ ] **Step 1: Mở rộng type trả về**

Sửa `AuthTokens`:
```ts
type AuthTokens = {
  userId: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: GoogleUser;
};
```
Sửa `buildAuthTokens` thêm `userId`:
```ts
  private buildAuthTokens(userId: string, email: string, refreshToken: string, user: GoogleUser): AuthTokens {
    const accessToken = this.tokenService.createAccessToken(userId, email);
    return { userId, accessToken, accessTokenExpiresAt: this.accessExpiry(), refreshToken, user };
  }
```

- [ ] **Step 2: Sửa transaction trong `exchangeGoogleLoginCode`**

Thay block transaction hiện tại bằng:
```ts
    const refreshTokenRaw = await this.databaseService.$transaction(async (tx) => {
      const device = await this.deviceService.upsertDevice(
        { fingerprint: ctx.deviceFingerprint, deviceName: ctx.deviceName, userAgent: ctx.userAgent },
        tx,
      );
      await this.deviceService.linkDeviceUser({ deviceId: device.id, userId: user.id }, tx);
      // Multi-account: nếu account đã có phiên sống thì cấp token mới cho phiên đó, chưa có thì tạo mới.
      // KHÔNG đụng tới account khác (mỗi account 1 cookie riêng, cùng tồn tại).
      const existingSession = await this.sessionService.findActiveSession(user.id, device.id, tx);
      if (existingSession) {
        return this.sessionService.issueFreshTokenForSession(existingSession, tx);
      }
      const session = await this.sessionService.createSession({ userId: user.id, deviceId: device.id }, tx);
      return session.refreshTokenRaw;
    });
```
Xoá field `previousRefreshToken` khỏi `ExchangeContext` và bỏ nhánh `revokeOrphanTokenKeepSession` (không còn token mồ côi vì không ghi đè cookie account khác).

- [ ] **Step 3: Sửa `refresh` nhận accountId để xác thực đúng chủ**

```ts
  /**
   * Input: accountId (chủ cookie) + refresh token raw từ cookie rt_<accountId>.
   * Output: Rotate token + access token mới. Ném AUTH_005 nếu token không thuộc accountId.
   */
  async refresh(
    accountId: string,
    rawToken: string,
  ): Promise<{ userId: string; accessToken: string; accessTokenExpiresAt: string; refreshToken: string }> {
    const rotated = await this.databaseService.$transaction((tx) => this.sessionService.rotateByRawToken(rawToken, tx));
    if (rotated.userId !== accountId) {
      throw new AppException(ERROR_CODES.AUTH_005);
    }
    const accessToken = this.tokenService.createAccessToken(rotated.userId, rotated.email);
    return {
      userId: rotated.userId,
      accessToken,
      accessTokenExpiresAt: this.accessExpiry(),
      refreshToken: rotated.refreshTokenRaw,
    };
  }
```

- [ ] **Step 4: Xoá `switchAccount` khỏi service**

Xoá toàn bộ method `switchAccount(...)`. (Switch là việc của client.)

- [ ] **Step 5: Verify compile**

Run: `cd api && npx tsc --noEmit`
Expected: chỉ còn lỗi ở `auth.controller.ts` (route switch + chữ ký refresh/logout cũ) — sửa Task 5.

### Task 5: Controller — exchange set rt_<userId>, refresh/logout theo accountId, bỏ switch

**Files:**
- Modify: `api/src/auth/auth.controller.ts`

- [ ] **Step 1: Import DTO + helper**

Thêm:
```ts
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { buildRefreshCookieName } from './auth.utils';
```
Bỏ import `SwitchAccountDto`, `REFRESH_TOKEN_COOKIE_NAME` nếu không còn dùng (giữ `REFRESH_TOKEN_COOKIE_PATH`, `REFRESH_TOKEN_TTL_MS`, `readCookieValue`).

- [ ] **Step 2: Exchange set cookie theo account**

Trong handler `exchangeGoogleCode`, thay phần set cookie:
```ts
      const result = await this.authService.exchangeGoogleLoginCode(body.code, changeToken, {
        deviceFingerprint: body.deviceFingerprint,
        deviceName: body.deviceName,
        userAgent: request.headers['user-agent'],
      });
      response.cookie(
        buildRefreshCookieName(result.userId),
        result.refreshToken,
        this.buildCookieOptions(REFRESH_TOKEN_COOKIE_PATH, REFRESH_TOKEN_TTL_MS),
      );
      return {
        userId: result.userId,
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        user: result.user,
      };
```

- [ ] **Step 3: Refresh theo accountId**

Thay handler `refresh`:
```ts
  @Post('refresh')
  async refresh(@Body() body: RefreshDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const rawToken = readCookieValue(request.headers.cookie, buildRefreshCookieName(body.accountId));
    if (!rawToken) throw new AppException(ERROR_CODES.AUTH_001);
    const result = await this.authService.refresh(body.accountId, rawToken);
    response.cookie(
      buildRefreshCookieName(result.userId),
      result.refreshToken,
      this.buildCookieOptions(REFRESH_TOKEN_COOKIE_PATH, REFRESH_TOKEN_TTL_MS),
    );
    return { userId: result.userId, accessToken: result.accessToken, accessTokenExpiresAt: result.accessTokenExpiresAt };
  }
```

- [ ] **Step 4: Logout 1 account**

Thay handler `logout`:
```ts
  @Post('logout')
  async logout(@Body() body: LogoutDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const cookieName = buildRefreshCookieName(body.accountId);
    const rawToken = readCookieValue(request.headers.cookie, cookieName);
    if (rawToken) await this.authService.logout(rawToken);
    response.clearCookie(cookieName, this.buildCookieOptions(REFRESH_TOKEN_COOKIE_PATH, REFRESH_TOKEN_TTL_MS));
    return { success: true };
  }
```
(Service `logout(rawToken)` giữ nguyên — đã revoke session theo token.)

- [ ] **Step 5: Xoá route `switch`**

Xoá toàn bộ handler `@Post('switch') switchAccount(...)`.

- [ ] **Step 6: `accounts` đọc account nào để xác định device?**

`GET /auth/accounts` hiện cần 1 refresh token để biết device. Đổi sang nhận `accountId` qua query và đọc cookie tương ứng:
```ts
  @Get('accounts')
  async accounts(@Query('accountId') accountId: string, @Req() request: Request) {
    if (!accountId) throw new AppException(ERROR_CODES.AUTH_001);
    const rawToken = readCookieValue(request.headers.cookie, buildRefreshCookieName(accountId));
    if (!rawToken) throw new AppException(ERROR_CODES.AUTH_001);
    return this.authService.listAccounts(rawToken);
  }
```
Thêm `Query` vào import `@nestjs/common`.

- [ ] **Step 7: Verify compile + boot**

Run: `cd api && npx tsc --noEmit && npm run build`
Expected: exit 0.
Run (boot, đọc log): `cd api && timeout 30 npm run start` rồi grep `Mapped` + đảm bảo KHÔNG có `can't resolve dependencies`. Routes mong đợi: `/auth/refresh POST`, `/auth/logout POST`, `/auth/accounts GET`, `/auth/devices GET`, `/auth/sessions/:id DELETE`, KHÔNG còn `/auth/switch`.

- [ ] **Step 8: Commit**

```bash
git add api/src/auth api/prisma
git commit -m "feat(auth): multi-account refresh cookies (rt_<accountId>), drop switch"
```

---

## Phase 2 — Frontend store đa account

### Task 6: Viết lại auth-store cho multi-account

**Files:**
- Modify: `ui/src/lib/auth-callback.ts` (schema thêm `userId`)
- Modify: `ui/src/stores/auth-store.ts`

- [ ] **Step 1: Thêm `userId` vào schema session**

Trong `auth-callback.ts`, sửa `authSessionSchema`:
```ts
export const authSessionSchema = z.object({
  userId: z.string().min(1),
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.string().min(1),
  user: z.object({
    provider: z.literal("google"),
    providerUserId: z.string().min(1),
    email: z.string().min(1),
    emailVerified: z.boolean(),
    fullName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
})
```

- [ ] **Step 2: Viết lại auth-store**

Thay toàn bộ `ui/src/stores/auth-store.ts`:
```ts
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { AuthSession } from "@/lib/auth-callback"

// Metadata account để render switcher (persist localStorage, KHÔNG chứa token).
type AccountMeta = {
  userId: string
  email: string
  fullName: string | null
  avatarUrl: string | null
}

// Access token sống trong memory, KHÔNG persist (bảo mật).
type AccountToken = {
  accessToken: string
  accessTokenExpiresAt: string
}

type AuthState = {
  accountList: AccountMeta[]
  tokens: Record<string, AccountToken>
  activeAccountId: string | null
  addAccount: (session: AuthSession) => void
  setActiveAccount: (accountId: string) => void
  updateAccessToken: (accountId: string, accessToken: string, accessTokenExpiresAt: string) => void
  removeAccount: (accountId: string) => void
}

export const AUTH_STORAGE_KEY = "joytab-auth-store"

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accountList: [],
      tokens: {},
      activeAccountId: null,

      addAccount: (session) =>
        set((state) => {
          const meta: AccountMeta = {
            userId: session.userId,
            email: session.user.email,
            fullName: session.user.fullName,
            avatarUrl: session.user.avatarUrl,
          }
          const accountList = [
            ...state.accountList.filter((a) => a.userId !== session.userId),
            meta,
          ]
          return {
            accountList,
            tokens: {
              ...state.tokens,
              [session.userId]: {
                accessToken: session.accessToken,
                accessTokenExpiresAt: session.accessTokenExpiresAt,
              },
            },
            activeAccountId: session.userId,
          }
        }),

      setActiveAccount: (accountId) => set({ activeAccountId: accountId }),

      updateAccessToken: (accountId, accessToken, accessTokenExpiresAt) =>
        set((state) => ({
          tokens: { ...state.tokens, [accountId]: { accessToken, accessTokenExpiresAt } },
        })),

      removeAccount: (accountId) =>
        set((state) => {
          const accountList = state.accountList.filter((a) => a.userId !== accountId)
          const { [accountId]: _removed, ...tokens } = state.tokens
          const activeAccountId =
            state.activeAccountId === accountId ? (accountList[0]?.userId ?? null) : state.activeAccountId
          return { accountList, tokens, activeAccountId }
        }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Chỉ persist danh sách account; token & active để memory/sessionStorage.
      partialize: (state) => ({ accountList: state.accountList }),
    },
  ),
)
```
Ghi chú: `activeAccountId` để memory (mỗi tab độc lập) cho phép Gmail-style; v1 mặc định null → khôi phục ở Task 9.

- [ ] **Step 3: Verify**

Run: `cd ui && npm run lint && npm run build`
Expected: lint sạch; build có thể lỗi ở các file còn dùng API store cũ (`session`, `loginWithSession`, `logout`) — sửa ở Task 7-9.

### Task 7: auth-api theo accountId

**Files:**
- Modify: `ui/src/lib/auth-api.ts`

- [ ] **Step 1: Thay refresh/switch/logout**

Bỏ `switchAccount`. Thêm/sửa:
```ts
const refreshResponseSchema = envelope(
  z.object({
    userId: z.string(),
    accessToken: z.string(),
    accessTokenExpiresAt: z.string(),
  }),
)

/**
 * Input: accountId; dựa vào cookie rt_<accountId>.
 * Output: Access token mới cho account đó.
 */
export async function refreshAccount(accountId: string) {
  const response = await apiClient.post("/auth/refresh", { accountId }, { withCredentials: true })
  return refreshResponseSchema.parse(response.data).data
}

/**
 * Input: accountId cần đăng xuất.
 * Output: Revoke session + clear cookie rt_<accountId> ở BE.
 */
export async function logoutAccount(accountId: string): Promise<void> {
  await apiClient.post("/auth/logout", { accountId }, { withCredentials: true })
}
```

- [ ] **Step 2: `fetchAccounts` truyền accountId**

```ts
export async function fetchAccounts(accountId: string): Promise<DeviceAccount[]> {
  const response = await apiClient.get("/auth/accounts", {
    params: { accountId },
    withCredentials: true,
  })
  return accountsResponseSchema.parse(response.data).data.accounts
}
```

- [ ] **Step 3: Verify compile**

Run: `cd ui && npx tsc --noEmit` (hoặc `npm run build`)
Expected: còn lỗi ở api-client/hooks/UI — sửa tiếp.

### Task 8: api-client — token của active account + refresh theo active accountId

**Files:**
- Modify: `ui/src/lib/api-client.ts`

- [ ] **Step 1: Request interceptor lấy token active**

```ts
    (config: InternalAxiosRequestConfig) => {
      const { activeAccountId, tokens } = useAuthStore.getState()
      const accessToken = activeAccountId ? tokens[activeAccountId]?.accessToken : undefined
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
      }
      return config
    },
```

- [ ] **Step 2: runRefresh theo active accountId**

```ts
async function runRefresh(): Promise<string> {
  const { activeAccountId } = useAuthStore.getState()
  if (!activeAccountId) throw new Error("No active account")
  const response = await axios.post(
    new URL("/auth/refresh", API_BASE_URL).toString(),
    { accountId: activeAccountId },
    { withCredentials: true },
  )
  const parsed = refreshResponseSchema.safeParse(response.data)
  if (!parsed.success) throw new Error("Invalid refresh response")
  const { userId, accessToken, accessTokenExpiresAt } = parsed.data.data
  useAuthStore.getState().updateAccessToken(userId, accessToken, accessTokenExpiresAt)
  return accessToken
}
```
Sửa `refreshResponseSchema` cho khớp (thêm `userId`):
```ts
const refreshResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    userId: z.string().min(1),
    accessToken: z.string().min(1),
    accessTokenExpiresAt: z.string().min(1),
  }),
})
```
Phần 401-retry: khi refresh fail → `useAuthStore.getState().removeAccount(activeAccountId)` (nếu có) thay vì `logout()`, rồi điều hướng `/login` nếu không còn account.

- [ ] **Step 3: Verify compile**

Run: `cd ui && npm run build`
Expected: còn lỗi ở hooks/UI.

### Task 9: hooks + khôi phục access token lúc load

**Files:**
- Modify: `ui/src/hooks/use-auth-api.ts`
- Create: `ui/src/hooks/use-restore-accounts.ts`

- [ ] **Step 1: Sửa hooks**

Bỏ `useSwitchAccount`. Sửa các hook dùng `activeAccountId`:
```ts
export function useAccounts() {
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  return useQuery({
    queryKey: ["auth", "accounts", activeAccountId],
    queryFn: () => fetchAccounts(activeAccountId as string),
    enabled: Boolean(activeAccountId),
  })
}

export function useLogout() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const removeAccount = useAuthStore((s) => s.removeAccount)
  return useMutation({
    mutationFn: (accountId: string) => logoutAccount(accountId),
    onSettled: (_d, _e, accountId) => {
      removeAccount(accountId)
      queryClient.clear()
      if (!useAuthStore.getState().activeAccountId) router.replace("/login")
    },
  })
}
```
`useDevices`/`useRevokeSession` giữ nguyên (dùng Bearer của active account).

- [ ] **Step 2: Hook khôi phục access token sau reload**

Tạo `use-restore-accounts.ts`:
```ts
"use client"

import { useEffect, useRef } from "react"
import { refreshAccount } from "@/lib/auth-api"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận tham số; chạy 1 lần lúc mount client.
 * Output: Với account đang active (đã có trong danh sách persist) nhưng chưa có access token trong memory,
 *         gọi refresh để khôi phục access token từ cookie rt_<accountId>.
 */
export function useRestoreAccounts() {
  const ranRef = useRef(false)
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const { accountList, activeAccountId, tokens, setActiveAccount } = useAuthStore.getState()
    const targetId = activeAccountId ?? accountList[0]?.userId
    if (!targetId) return
    if (!activeAccountId) setActiveAccount(targetId)
    if (tokens[targetId]) return
    refreshAccount(targetId)
      .then((r) => useAuthStore.getState().updateAccessToken(r.userId, r.accessToken, r.accessTokenExpiresAt))
      .catch(() => useAuthStore.getState().removeAccount(targetId))
  }, [])
}
```

- [ ] **Step 3: Verify compile**

Run: `cd ui && npm run build`
Expected: còn lỗi ở UI (`home-page-client`, `callback-client`) — sửa Task 10.

### Task 10: UI — account switcher + callback + private layout

**Files:**
- Modify: `ui/src/app/(auth)/login/callback/callback-client.tsx`
- Modify: `ui/src/app/(private)/home-page-client.tsx`
- Modify: `ui/src/app/(private)/layout.tsx`

- [ ] **Step 1: Callback dùng addAccount**

Trong `callback-client.tsx`, đổi `loginWithSession` → `addAccount`:
```ts
  const addAccount = useAuthStore((state) => state.addAccount)
  // ...
    onSuccess: (session) => {
      addAccount(session)
      router.replace("/")
    },
```

- [ ] **Step 2: Private layout dựa trên activeAccountId**

Trong `(private)/layout.tsx`, thay điều kiện auth:
```ts
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const accountList = useAuthStore((s) => s.accountList)
  const isAuthed = accountList.length > 0
  useEffect(() => {
    if (hasHydrated && !isAuthed) router.replace("/login")
  }, [hasHydrated, isAuthed, router])
  if (!hasHydrated || !isAuthed) return null
  return children
```
(activeAccountId có thể tạm null cho tới khi `useRestoreAccounts` set; vẫn render vì có account trong list.)

- [ ] **Step 3: Home — switcher + gọi useRestoreAccounts**

Trong `home-page-client.tsx`:
```ts
  useRestoreAccounts()
  const accountList = useAuthStore((s) => s.accountList)
  const activeAccountId = useAuthStore((s) => s.activeAccountId)
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount)
  const logout = useLogout()
```
Render danh sách `accountList`: account active highlight; account khác có nút "Dùng" → `setActiveAccount(a.userId)` (tức thì, không gọi server); nút "Đăng xuất" → `logout.mutate(a.userId)`. Nút "Thêm tài khoản" giữ nguyên (`redirectToGoogleLogin({ selectAccount: true })`).
Khối "Tài khoản trên thiết bị" (`useAccounts`) và "Thiết bị/phiên" (`useDevices`) giữ nguyên, chỉ bỏ nút Switch cũ.

- [ ] **Step 4: Verify**

Run: `cd ui && npm run lint && npm run build`
Expected: lint sạch, build exit 0, routes như cũ.

- [ ] **Step 5: Commit**

```bash
git add ui/src
git commit -m "feat(ui): concurrent multi-account with per-account refresh cookies"
```

---

## Phase 3 — Cleanup & verify

### Task 11: Dọn tàn dư switch + verify end-to-end

**Files:**
- Modify: `ui/src/lib/auth-api.ts` (bỏ import/symbol switch còn sót)
- Delete: `api/src/auth/dto/switch-account.dto.ts` (nếu không còn ai dùng)

- [ ] **Step 1: Grep tàn dư**

Run: `cd /home/thiencv/workspace/project/joytab && grep -rn "switch" api/src ui/src | grep -vi "switchToHttp"`
Expected: không còn tham chiếu `switchAccount`/route switch. Xoá nếu còn.

- [ ] **Step 2: Xoá DTO switch nếu mồ côi**

Run: `grep -rn "SwitchAccountDto" api/src`
Nếu rỗng: `git rm api/src/auth/dto/switch-account.dto.ts`.

- [ ] **Step 3: Verify toàn bộ**

Run: `cd api && npx tsc --noEmit && npm run build`
Run: `cd ui && npm run lint && npm run build`
Expected: tất cả exit 0.

- [ ] **Step 4: Verify runtime (thủ công, cần OAuth + DB)**

1. Boot BE + FE (`pnpm dev` mỗi bên).
2. Login account A → dashboard hiện A.
3. "Thêm tài khoản" → chọn B → quay lại: danh sách có A & B, đang active B.
4. Bấm "Dùng" ở A → đổi tức thì (không có request mạng mới ngoài data fetch).
5. DevTools → Application → Cookies: thấy `rt_<idA>` và `rt_<idB>` cùng tồn tại, path `/auth`, httpOnly.
6. Đợi access token A hết hạn (hoặc xoá khỏi memory) → thao tác → thấy `POST /auth/refresh {accountId: idA}` trả token mới, không đụng B.
7. "Đăng xuất" A → chỉ cookie `rt_<idA>` bị xoá, B vẫn login.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(auth): remove switch remnants, finalize multi-account"
```

---

## Rủi ro & lưu ý

- **Bảo mật:** N cookie refresh sống cùng lúc → bề mặt lớn hơn. Bắt buộc `httpOnly`, `Secure` (prod), `SameSite` phù hợp, path `/auth`. Reuse detection per-session giữ nguyên.
- **Giới hạn cookie:** ~180 cookie/domain, 4KB/cookie. Với vài account là dư; nên đặt cận trên số account (vd 8) ở FE và báo người dùng.
- **Khôi phục sau reload:** access token không persist → lần load đầu phải refresh active account (Task 9). Account khác lazy-refresh khi `setActiveAccount`. Cân nhắc refresh sẵn tất cả nếu muốn switcher hiển thị trạng thái "đã sẵn sàng".
- **Concurrent tabs thực thụ:** `activeAccountId` để memory/sessionStorage (không persist localStorage) để mỗi tab 1 account. v1 này để memory; muốn giữ active theo tab qua reload thì chuyển sang `sessionStorage`.
- **Migration người dùng cũ:** cookie `refresh_token` (tên cũ) sẽ không được dùng nữa → user đang đăng nhập phải login lại 1 lần. Chấp nhận cho v1 hoặc thêm bước migrate đọc cookie cũ ở lần refresh đầu (ngoài phạm vi).
- **`is_active` trên device_users:** không còn ràng buộc unique; có thể dùng làm "account xem gần nhất" hoặc bỏ hẳn ở migration sau.
