# Bỏ session + device, chuyển sang JWT (AT + RT cookie)

Ngày: 2026-07-29

## Mục tiêu

Bỏ hoàn toàn cơ chế session-cookie tra DB mỗi request và toàn bộ phần quản lý thiết bị.
Thay bằng access token JWT stateless (verify in-memory, không chạm DB) cộng refresh token
opaque xoay vòng, lưu hash trong DB để còn thu hồi được. FE lưu user vào zustand store
persist localStorage, load lại trang là hiển thị được ngay.

Phạm vi: đúng phần auth. Không thêm tính năng mới, không đổi UI ngoài việc dọn những chỗ
đang phụ thuộc vào device/session.

## Quyết định đã chốt

| Vấn đề | Chốt | Lý do |
|---|---|---|
| Thu hồi token | Có, qua 1 bảng `refresh_tokens` | Cần logout thật và cắt được RT bị lộ. Bảng này **không phải** session management quay lại: không device, không `last_used_at`, không endpoint liệt kê phiên |
| AT | JWT, TTL 1 giờ, stateless | API nghiệp vụ verify in-memory, không query DB |
| RT | Chuỗi random 32 bytes (opaque), DB lưu SHA-256, TTL 7 ngày, rotate mỗi lần refresh | Đã phải tra DB dù sao nên JWT không thêm được gì; token ngắn hơn, không mang claim nào, DB bị lộ cũng không dựng lại được token |
| Ai refresh | FE axios interceptor, single-flight | Guard BE thuần verify, dễ test; rotation không xảy ra trong GET request |
| Phát hiện RT dùng lại | Revoke toàn bộ RT còn sống của user đó | Dấu hiệu token bị copy |
| FE lấy user | Trang `/auth/callback` gọi `/auth/me` **một lần** sau login | OAuth là redirect 302 nên không có body để trả user về |
| FE giữ user | zustand + `persist` localStorage, boot **không** gọi `/auth/me` | Load lại trang hiển thị ngay, không nháy loading |
| Bảng cũ | DROP `user_sessions` + `devices` | Không còn code nào dùng |
| Endpoint quản lý phiên | Không có `/auth/devices`, `/auth/sessions/:id`, `/auth/logout-all` | Ngoài phạm vi |

## Đánh đổi phải biết trước

1. **AT stateless nên revoke chỉ có hiệu lực ngay với RT.** AT đang cầm trong tay vẫn dùng
   được tối đa 1 giờ sau khi logout hoặc sau khi RT bị revoke. Đây là bản chất của mô hình,
   không phải bug. Cửa sổ này = TTL của AT.
2. **Boot không validate.** Cookie đã hết hạn mà localStorage còn user thì UI vẫn hiện
   trạng thái đã đăng nhập, tới request API đầu tiên mới nhận 401 và interceptor đẩy về
   `/login`. Hệ quả trực tiếp của lựa chọn "chỉ persist, không gọi `/auth/me` lúc boot".
3. **Đổi tên cookie nên mọi người đang đăng nhập sẽ bị đăng xuất** khi deploy. Không tránh được.
4. **Row `refresh_tokens` hết hạn chưa được dọn tự động.** Chưa cần cron ở giai đoạn này;
   bảng chỉ tăng theo số lần refresh. Ghi lại đây để sau này nhớ.

## Token model

|  | Access token | Refresh token |
|---|---|---|
| Cookie | `at` | `rt` |
| Dạng | JWT HS256 | `randomBytes(32).hex` — 64 ký tự, không mang thông tin gì |
| TTL | 1 giờ | 7 ngày, reset lại mỗi lần rotate |
| Payload | `{ sub, email, typ: 'at' }` | — |
| Secret | `JWT_ACCESS_SECRET` | không cần |
| State | không | 1 row `refresh_tokens`, khớp bằng `token_hash` = SHA-256(raw) |

Chỉ AT là JWT. RT đã buộc phải tra DB để rotate/revoke nên chữ ký JWT không thêm được gì
ngoài độ dài cookie. Hash SHA-256 trần, không salt/KDF: token đã có 32 bytes entropy nên
không có gì để brute-force.

Đổi `JWT_ACCESS_SECRET` → vô hiệu mọi AT đang lưu hành nhưng **không** đăng xuất ai: RT vẫn
sống, FE refresh xong là đi tiếp (chậm nhất 1 giờ). Muốn đăng xuất toàn bộ thì revoke bảng
`refresh_tokens`.

Cookie options dùng lại `buildCookieOptions` đang có ở [auth.controller.ts](../../../api/src/auth/auth.controller.ts):
`httpOnly`, `sameSite=lax`, `path=/`, `secure` khi production, `domain` theo `COOKIE_DOMAIN`
nếu có. Tách hàm này ra `auth.utils.ts` vì giờ nhiều endpoint cùng dùng.

## Luồng

### Login

```
FE /login  ──bấm──▶  BE GET /auth/google  ──▶  Google
Google  ──▶  BE GET /auth/google/callback
                 ├─ upsert users theo provider_user_id
                 ├─ issue RT: random raw + insert row (token_hash = sha256(raw))
                 ├─ sign AT
                 ├─ Set-Cookie: at (JWT), rt (raw)
                 └─ 302 → ${FRONTEND_ORIGIN}/auth/callback
FE /auth/callback  ──▶  GET /auth/me  ──▶  { userId, user }
                 ├─ setUser(user)  (persist localStorage)
                 └─ router.replace('/')
```

Callback thất bại ở bất kỳ bước nào → 302 về `${FRONTEND_ORIGIN}/login` (giữ nguyên hành vi
hiện tại).

### Request nghiệp vụ + refresh

```
FE  ──▶  API bất kỳ (cookie at)
         JwtAuthGuard verify at  ──▶  ok: gán req.userId, req.userEmail
                                 └──▶  hết hạn: 401 AUTH_005

FE interceptor thấy 401 AUTH_005 (và request chưa retry, và không phải /auth/refresh):
         ──▶  POST /auth/refresh   (single-flight: nhiều 401 cùng lúc dùng chung 1 promise)
              ├─ ok  → retry request gốc
              └─ fail → clearUser() + window.location = '/login'
```

### POST /auth/refresh

1. Đọc cookie `rt`. Không có → `AUTH_006`.
2. Tra `refresh_tokens` theo `token_hash = sha256(raw)`. Không thấy → `AUTH_006`.
3. `revoked_at != null` → **reuse detected** → `revokeAllForUser(row.user_id)` → `AUTH_006`.
4. `expires_at <= now` → `AUTH_006`.
5. `rotate(row.id, row.user_id)` — trong 1 transaction: insert row mới (raw mới,
   `expires_at = now + 7d`), update row cũ `{ revoked_at: now, replaced_by: <id row mới> }`.
6. Sign AT mới, set lại cookie `at` + `rt` (raw mới).
7. Trả `{ userId, user }` — cùng shape với `/auth/me` để FE cập nhật store luôn nếu cần.

Bước 3 đứng trước bước 4 có chủ ý: RT đã bị revoke thì luôn coi là tín hiệu tấn công, kể cả
khi nó cũng đã hết hạn.

Không cần check `row.user_id` khớp với gì cả — `token_hash` unique nên row tìm được chính là
chủ sở hữu, không có claim nào từ client để phải đối chiếu. Đây là một cái lợi cụ thể của RT
opaque so với JWT.

### POST /auth/logout

Không cần guard. Đọc cookie `rt` → `revokeByRawToken(raw)` (hash rồi `updateMany`, không khớp
thì no-op) → clear cookie `at` và `rt` → trả `{ success: true }`.
Không ném lỗi khi token vô hiệu: logout phải luôn thành công.

FE `useLogout` clear store (kèm localStorage) và query cache rồi về `/login`.

## Database

### Schema

Bỏ model `Device`, bỏ model `UserSession`, bỏ field `user_sessions` trên `User`. Thêm:

```prisma
model RefreshToken {
  id          String    @id @default(uuid()) @db.Uuid
  user_id     String    @db.Uuid
  token_hash  String    @unique                        // SHA-256 của RT thô
  expires_at  DateTime  @db.Timestamptz(6)
  revoked_at  DateTime? @db.Timestamptz(6)
  replaced_by String?   @db.Uuid                        // lần theo chuỗi rotation
  created_at  DateTime  @default(now()) @db.Timestamptz(6)
  user        User      @relation(fields: [user_id], references: [id])

  @@index([user_id, revoked_at])
  @@map("refresh_tokens")
}
```

`User` thêm `refresh_tokens RefreshToken[]`.

### Migration

`api/prisma/migrations/20260729000000_replace_sessions_with_refresh_tokens/migration.sql`:

```sql
DROP TABLE IF EXISTS "user_sessions";
DROP TABLE IF EXISTS "devices";

CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

Apply bằng `pnpm db:migrate:deploy`, rồi `pnpm db:generate` để dọn
`api/src/generated/prisma/models/Device.ts` và `UserSession.ts`.

## Backend — file theo file

### Xóa

- `api/src/auth/session.service.ts`
- `api/src/auth/device.service.ts`
- `api/src/auth/token.service.ts` (chỉ sinh session token ngẫu nhiên, không còn dùng)
- `api/src/common/guards/session.guard.ts`

### Thêm

**`api/src/auth/jwt.service.ts`** — class đặt tên `AuthJwtService` để không trùng `JwtService`
của `@nestjs/jwt` mà nó bọc bên trong. Chỉ lo access token:

- `signAccessToken({ userId, email }): Promise<string>`
- `verifyAccessToken(token): Promise<AccessTokenPayload>` — **chỉ** hết hạn → `AUTH_005`;
  sai chữ ký / sai `typ` / malformed → `AUTH_001`. Phân biệt hai nhánh này là bắt buộc:
  FE chỉ refresh khi thấy `AUTH_005`, nên token bị giả mạo phải trả `AUTH_001` để không
  kéo FE vào vòng refresh vô nghĩa.

Nhận diện token hết hạn bằng `err.name === 'TokenExpiredError'` chứ không `instanceof`:
`jsonwebtoken` là transitive dependency của `@nestjs/jwt`, pnpm strict không cho import trực tiếp.

**`api/src/auth/refresh-token.service.ts`** — vòng đời refresh token. Trả `{ raw, row }`: `raw`
đi vào cookie, DB chỉ giữ `token_hash`.

- `issue(userId): Promise<{ raw, row: { id } }>` — một insert, không cần transaction (lúc login)
- `findByRawToken(raw): Promise<RefreshToken | null>` — hash rồi `findUnique` theo `token_hash`;
  trả row thô, controller tự áp 3 điều kiện (không thấy / đã revoke / hết hạn) để giữ service
  không biết gì về error code của luồng HTTP
- `rotate(oldId, userId): Promise<{ raw, row: { id } }>` — tự mở `$transaction` bên trong:
  insert row mới rồi update row cũ `{ revoked_at, replaced_by }`
- `revokeByRawToken(raw): Promise<void>` — `updateMany`, không khớp thì no-op
- `revokeAllForUser(userId): Promise<void>`
- private `createRawToken()` = `randomBytes(32).hex`, private `hashToken()` = SHA-256 hex

**`api/src/common/guards/jwt-auth.guard.ts`** — đọc cookie `at` → `verifyAccessToken` → gán
`request.userId`, `request.userEmail`. Không có cookie → `AUTH_001`.

### Sửa

**`api/src/auth/auth.constants.ts`** — bỏ toàn bộ `SESSION_*` và `DEVICE_*`. Thêm:

```ts
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;              // 1 giờ
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;    // 7 ngày
export const REFRESH_TOKEN_BYTES = 32;                        // → 64 ký tự hex
export const ACCESS_COOKIE_NAME = 'at';
export const REFRESH_COOKIE_NAME = 'rt';
export const ACCESS_TOKEN_TYPE = 'at';                        // claim `typ`
```

Giữ `COOKIE_PATH`, `AUTH_THROTTLE_*`, `DEFAULT_FRONTEND_ORIGIN`.

**`api/src/auth/auth.utils.ts`** — xóa `isUuid`, `parsePlatformFromUserAgent`,
`parseDeviceNameFromUserAgent`. Giữ `readCookieValue`, `buildGoogleLoginFailedRedirectUrl`,
`normalizeFrontendOrigin`. Đổi `buildPostLoginRedirectUrl` để trả `/auth/callback` thay vì `/`.
Thêm `buildAuthCookieOptions(configService, maxAgeMs)` chuyển từ private method của controller ra.

**`api/src/auth/auth.service.ts`** — còn lại:

- `loginWithGoogle(googleUser)` → upsert user, trả `{ userId, user }`. Không còn transaction
  device/session ở đây; việc issue RT do controller gọi `refreshTokenService`.
- `getMe(userId)` → giữ nguyên
- Xóa `logout`, `listDevices`, `revokeSession`
- Bỏ inject `SessionService`, `DeviceService`

**`api/src/auth/auth.controller.ts`**

| Route | Thay đổi |
|---|---|
| `GET /auth/google` | không đổi |
| `GET /auth/google/callback` | bỏ đọc cookie `device_id`; upsert user → issue RT → sign AT → set 2 cookie → 302 `${FE}/auth/callback` |
| `POST /auth/refresh` | **mới**, theo 7 bước ở trên |
| `GET /auth/me` | đổi `SessionGuard` → `JwtAuthGuard`, shape response giữ nguyên |
| `POST /auth/logout` | bỏ revoke session; `revokeByRawToken` + clear 2 cookie |
| `GET /auth/devices` | **xóa** |
| `DELETE /auth/sessions/:id` | **xóa** |

Giữ `@Throttle` ở cấp controller cho cả `/auth/refresh`.

**`api/src/auth/auth.module.ts`** — imports thêm `JwtModule.register({})` (secret truyền theo
từng lần sign/verify nên không cấu hình global). Providers: `AuthService`, `GoogleStrategy`,
`AuthJwtService`, `RefreshTokenService`. Exports: `AuthJwtService` (cho `JwtAuthGuard`).

**`api/src/app.module.ts`** — thêm `JWT_ACCESS_SECRET` vào `REQUIRED_ENV_KEYS`.

**`api/src/common/constants/error-codes.constant.ts`**

- Xóa `AUTH_004` (`Session revoked`) — không còn khái niệm session bị revoke mà FE phải xử lý riêng
- `AUTH_005`: `Session expired` → `Access token expired`
- Thêm `AUTH_006`: `Refresh token invalid or expired`
- Thêm `SYS_014`: `Missing JWT_ACCESS_SECRET`

**`api/src/common/exceptions/app.exception.ts`** — `mapStatusByCode`: bỏ case `AUTH_004`,
thêm case `AUTH_006` → 401.

**`api/package.json`** — thêm `@nestjs/jwt`.

**`api/.env.example`** — thêm `JWT_ACCESS_SECRET` (bắt buộc, sinh bằng `openssl rand -base64 48`),
ghi rõ RT không dùng secret. Cập nhật chú thích cookie: giờ là 2 cookie `at`/`rt`, TTL 1h/7d.
`COOKIE_DOMAIN` giữ nguyên ý nghĩa.

## Frontend — file theo file

### Thêm

**`ui/src/app/auth/callback/page.tsx`** — đặt ngoài route group `(auth)` để URL đúng là
`/auth/callback` và không mang chrome của trang login. Client component: gọi `fetchMe()` một
lần → `setUser(user)` → `router.replace('/')`; lỗi → `router.replace('/login')`. Render
`LoadingScreen` trong lúc chờ. Đây là chỗ **duy nhất** trong app gọi `/auth/me`.

### Sửa

**`ui/src/stores/auth-store.ts`** — bọc `persist` (không cần thêm dep, zustand 5 đã có):

```ts
{
  user: CurrentUser | null
  hydrated: boolean          // persist đã đọc localStorage xong
  setUser(user): void
  clearUser(): void
}
```

`name: 'joytab-auth'`, `partialize` chỉ lưu `user` (không lưu `hydrated`),
`onRehydrateStorage: () => () => useAuthStore.setState({ hydrated: true })`. Bỏ hẳn field
`checked`.

`clearUser` phải xóa cả bản trong localStorage — `persist` tự ghi lại khi state đổi nên
`set({ user: null })` là đủ, không cần gọi `clearStorage()` thủ công.

**Bắt buộc đặt `skipHydration: true`.** Nếu để persist tự hydrate lúc import module thì
localStorage đọc đồng bộ xong ngay, client có user ở render đầu tiên trong khi server render
ra `null` → React báo hydration mismatch. Với `skipHydration`, `AppWrapper` gọi
`rehydrate()` trong `useEffect` nên render đầu của client giống hệt server.

**`ui/src/components/wrapper/app-wrapper.tsx`** — không gọi `useMe` nữa. Nhiệm vụ mới: gọi
`useAuthStore.persist.rehydrate()` trong `useEffect` và chặn render tới khi `hydrated`.
Chưa hydrate → `LoadingScreen` (dài đúng một tick, không chờ network).

**`ui/src/components/wrapper/require-auth.tsx`** và **`require-guest.tsx`** — chỉ đọc `user`,
bỏ `checked` (hydration đã do `AppWrapper` lo).

**`ui/src/api/client.ts`** — viết lại response interceptor:

- Bỏ nhánh `AUTH_004`
- 401 + code `AUTH_005` + request chưa từng retry + url không phải `/auth/refresh`
  → gọi refresh rồi retry request gốc (đánh dấu `config._retried = true`)
- Single-flight: một biến `refreshPromise` trong closure của `createApiClient`; request nào
  tới trong lúc đang refresh thì `await` cùng promise đó, không tự gọi thêm. **Bắt buộc**, không
  phải tối ưu: RT xoay vòng nên hai lần refresh đồng thời thì lần thứ hai dùng RT đã bị revoke
  → BE coi là reuse và revoke sạch token của user, đăng xuất oan.
- Refresh fail → `useAuthStore.getState().clearUser()` + `window.location.href = '/login'`
- 401 với code khác `AUTH_005` (tức `AUTH_001`) → không refresh, `clearUser()` + về `/login` ngay
- 401 ở `/auth/me` và `/auth/refresh` → không tự xử lý, để caller quyết (trang callback tự
  điều hướng)

**`ui/src/api/auth.ts`** — xóa `fetchDevices`, `revokeSession`. Thêm
`refresh(): Promise<CurrentUser>` gọi `POST /auth/refresh` và parse bằng `meResponseSchema`.
Giữ `fetchMe`, `logout`.

**`ui/src/hooks/use-auth-api.ts`** — xóa `useMe`, `useDevices`, `useRevokeSession`,
`extractErrorCode`. Giữ `useLogout`, thêm `clearUser()` vào `onSuccess`. Trang callback dùng
`fetchMe` trực tiếp trong `useEffect`, không cần react-query cho một lần gọi.

**`ui/src/schema/auth.ts`** — xóa `deviceSchema`, `devicesResponseSchema`. Giữ `userSchema`,
`meResponseSchema`.

**`ui/src/types/auth.ts`** — xóa `DeviceSession`.

**`ui/src/app/(private)/_components/current-user-card.tsx`** — bỏ `checked` và biến
`isPending`; đọc `user` từ store là xong (AppWrapper đã bảo đảm hydrate rồi).

**`ui/package.json`** — bỏ `@fingerprintjs/fingerprintjs`: dep này chỉ có ý nghĩa cho device
fingerprint, không còn chỗ dùng.

## Error handling

| Tình huống | Code | HTTP | FE làm gì |
|---|---|---|---|
| Không có cookie `at`, hoặc AT sai chữ ký / sai `typ` / malformed | `AUTH_001` | 401 | clear store, về `/login` (**không** refresh) |
| AT hết hạn | `AUTH_005` | 401 | refresh rồi retry |
| RT thiếu / không khớp hash nào / hết hạn / đã revoke | `AUTH_006` | 401 | clear store, về `/login` |
| Google profile không có email | `AUTH_002` | 400 | callback BE redirect `/login` |
| Thiếu `JWT_ACCESS_SECRET` lúc boot | `SYS_014` | — | app không start (`REQUIRED_ENV_KEYS`) |

RT reuse trả cùng `AUTH_006` như các lỗi RT khác — không tiết lộ cho client rằng đã phát hiện
reuse. Ghi log warning ở BE.

## Verify

Viết spec tạm, chạy pass, rồi xóa (repo không commit spec).

**`jwt.service`**

- `signAccessToken` → `verifyAccessToken` trả đúng `sub`, `email`
- AT hết hạn → `AUTH_005` (chỉ mã này, để FE biết đường refresh)
- AT sai chữ ký → `AUTH_001`, không phải `AUTH_005`
- AT malformed → `AUTH_001`
- Token sai `typ` (sign bằng secret đúng nhưng `typ` khác) → `AUTH_001`

**`refresh-token.service`**

- `issue` trả raw 64 ký tự hex, row có `revoked_at = null`, `expires_at ≈ now + 7d`
- DB lưu SHA-256 của raw, không lưu raw
- `findByRawToken` tìm được row từ raw; raw khác → null
- `rotate` trả raw mới khác raw cũ, tạo row mới và set `revoked_at` + `replaced_by` trên row cũ
- `revokeByRawToken` set `revoked_at`; gọi với raw không tồn tại → no-op, không ném lỗi
- `revokeAllForUser` set `revoked_at` cho mọi row còn sống của user, không đụng user khác

**`auth.controller` — `/auth/refresh`**

- RT hợp lệ → 200, cookie `at` và `rt` đều đổi, raw mới khác raw cũ
- Gọi lại bằng RT vừa bị rotate → `AUTH_006` **và** mọi RT còn sống của user đó bị revoke
- RT trỏ tới row đã hết hạn → `AUTH_006`
- RT không khớp hash nào trong DB → `AUTH_006`
- Không có cookie `rt` → `AUTH_006`

**`jwt-auth.guard`**

- Không cookie → `AUTH_001`
- AT hợp lệ → gán `req.userId`, `req.userEmail`

**Smoke test tay** (sau khi code xong): login Google → thấy user ở `/` → F5 hiện ngay không
nháy → xóa cookie `at` trong devtools, gọi lại 1 API → thấy `/auth/refresh` chạy và request
retry thành công → logout → F5 phải về `/login`.

## Thứ tự triển khai

1. Prisma schema + migration + `db:generate`
2. Error codes + `AppException.mapStatusByCode`
3. `auth.constants.ts` + `auth.utils.ts`
4. `jwt.service.ts` + `refresh-token.service.ts` + spec
5. `jwt-auth.guard.ts`
6. `auth.service.ts` + `auth.controller.ts` + `auth.module.ts` + `app.module.ts` + spec
7. Xóa 4 file BE cũ, `.env.example`, `.env` local
8. FE store persist + `AppWrapper` + 2 wrapper
9. FE `api/client.ts` interceptor single-flight
10. FE trang `/auth/callback`, dọn `api/auth.ts` / hooks / schema / types / card / package.json
11. Chạy spec, xóa spec, smoke test tay
