# Thiết kế: Auth bằng session cookie đơn giản (website-only)

Ngày: 2026-06-08

## Bối cảnh

Auth hiện tại phức tạp: JWT access token HS256 (1h) qua header `Authorization: Bearer` +
refresh token xoay vòng (7d) có reuse-detection, cookie `rt_<userId>` per-account và
`google_change_token`, code-exchange qua Redis, accessToken lưu localStorage, auto-refresh
ở axios interceptor. Bảng: `User`, `Device`, `DeviceUser`, `UserSession`, `RefreshToken`.

Mục tiêu: rút gọn về một mô hình **session cookie thuần**, website-only, không refresh token.

## Mục tiêu / Không làm

**Mục tiêu**
- Bỏ refresh token và JWT access token. Xác thực mọi request bằng session cookie do server tra DB.
- Chỉ dùng **2 cookie** (`session_id`, `device_id`), đều httpOnly, do BE quản lý.
- Multi-account trên cùng device, switch bằng `device_id` + `/auth/switch`.
- Login: callback set cookie rồi redirect thẳng, không còn code/change-token/exchange.
- Rút gọn schema: bỏ `RefreshToken`, bỏ `device_fingerprint`.

**Không làm**
- Không hỗ trợ native app / mobile (website-only).
- Không giữ accessToken ở client, không Bearer header, không Redis cache code.

## Cookie (chỉ 2, đều httpOnly + secure(prod) + SameSite=lax)

| Cookie | Nội dung | TTL | Ghi chú |
|--------|----------|-----|---------|
| `device_id` | UUID của `Device`, BE tạo | dài (1 năm) | định danh trình duyệt, nền tảng switch account |
| `session_id` | raw session token của session đang active | 7 ngày (sliding) | xác thực request |

- Bỏ hẳn: `rt_<userId>`, `google_change_token`, accessToken ở localStorage.
- `SameSite=lax` để OAuth redirect (top-level GET) vẫn gửi được cookie; mọi endpoint same-origin.
  Custom header không cần vì không còn Bearer; CSRF dựa vào SameSite + same-origin.

## Schema (Prisma)

**Bỏ model `RefreshToken`** hoàn toàn (drop bảng `refresh_tokens`).

**`UserSession`** — thêm `token_hash`, bỏ quan hệ refresh_tokens:
```prisma
model UserSession {
  id            String    @id @default(uuid()) @db.Uuid
  user_id       String    @db.Uuid
  device_id     String    @db.Uuid
  token_hash    String    @unique          // SHA-256 của raw session token (mới)
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

**`Device`** — bỏ `device_fingerprint` (cả cột lẫn @unique). Định danh thuần bằng cookie `device_id` (= `Device.id`):
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

**Giữ nguyên** `User`, `DeviceUser`.

**Migration:** drop `refresh_tokens`; drop cột `device_fingerprint`; thêm `token_hash`. Vì `token_hash`
NOT NULL + unique không có giá trị cho row cũ → xoá sạch `user_sessions` hiện có (mọi user phải login lại). Chấp nhận được.

## Luồng hoạt động

### Login (Google) — callback làm hết, redirect thẳng
1. `GET /auth/google` → redirect sang Google (kèm `state` chống CSRF, Passport quản lý).
2. `GET /auth/google/callback` → Passport validate, có `GoogleUser`:
   - Upsert `User` (theo provider + provider_user_id).
   - Đọc `device_id` cookie: có thì dùng, không thì tạo `Device` (parse device_name/platform từ User-Agent) và set cookie `device_id`.
   - Upsert `DeviceUser(device, user)` `is_active=true`.
   - Tạo `UserSession(user, device)`: sinh raw token + lưu `token_hash`, `expires_at = now + 7d`.
   - Set-Cookie `session_id` = raw token (+ `device_id` nếu mới).
   - **302 redirect** về frontend (vd `/login/callback`). Không token trên URL.
3. Frontend trang callback gọi `/auth/me` để nạp state rồi vào app.

### Xác thực mỗi request (`SessionGuard`)
- Đọc `session_id` + `device_id` từ cookie.
- Tra `UserSession` theo hash(`session_id`); kiểm tra: `device_id` khớp, `is_revoked=false`, `expires_at > now`.
- Hợp lệ → gắn `request.userId`, `request.userEmail`.
- **Sliding renew chỉ khi còn < 1 ngày**: cập nhật `last_used_at` + `expires_at = now + 7d`. Phần lớn request không ghi DB.
- Không hợp lệ → 401.

### Thêm account (multi-account)
- Login lại với `prompt=select_account`, **cùng `device_id`**.
- Link `DeviceUser(device, B)`, tạo `UserSession(B, device)`, set `session_id` = token của B → active = B.
- DB có nhiều `UserSession` (mỗi account 1), nhưng cookie chỉ giữ 1 session active.

### Switch account — `POST /auth/switch { userId }`
- Đọc `device_id`; verify `DeviceUser(device, userId)` tồn tại.
- Tìm `UserSession(userId, device)` còn hạn (không revoke, chưa hết hạn):
  - Còn hạn → **cấp lại token mới** (sinh raw mới + cập nhật `token_hash`), set `session_id`. (DB chỉ lưu hash nên không khôi phục raw cũ; cấp mới là cách duy nhất.)
  - Hết hạn/revoke → trả 401/lỗi rõ ràng để FE hiện nút "đăng nhập lại" (bắt login Google lại). **Không tự cấp lại** khi đã hết hạn.

### Logout — `POST /auth/logout`
- Revoke session hiện tại (`is_revoked=true`, `revoke_reason='logout'`), xoá cookie `session_id`.
- Giữ `device_id` để các account khác trên device vẫn switch được.

### Remote revoke — `DELETE /auth/sessions/:id`
- Giữ như cũ, dùng `SessionGuard`. `GET /auth/devices` liệt kê session.

## Backend — thay đổi cụ thể

- `token.service.ts`: bỏ `createAccessToken`/`verifyAccessToken` (JWT) và refresh gen. Giữ random-token + SHA-256, đổi tên thành `createSessionToken()` / `hashToken()`. Có thể bỏ env `JWT_SECRET`.
- `session.service.ts`: bỏ `rotateByRawToken`, reuse-detection, `issueFreshTokenForSession`, `checkRawTokensStatus`. Thêm:
  - `createSession(userId, deviceId, tx)` → trả raw token, lưu `token_hash`.
  - `validateSession(rawToken, deviceId)` → kèm sliding renew (<1d).
  - `switchActiveSession(deviceId, userId)` → cấp lại token nếu còn hạn, else null.
  - Giữ `revokeByRawToken`, `revokeSessionOwnedByUser`.
- `device.service.ts`: `upsertDevice` theo `device_id` cookie (bỏ fingerprint). Tạo mới nếu chưa có. Giữ `linkDeviceUser`, `listAccountsByDevice`.
- `auth.service.ts`: `loginWithGoogle` không còn sinh code/Redis; logic tạo session chuyển vào callback (hoặc service được callback gọi).
- Guard: `AccessTokenGuard` → `SessionGuard` (đọc cookie thay Bearer).
- Endpoints:
  - **Bỏ**: `POST /auth/refresh`, `POST /auth/accounts/status`, `POST /auth/google/exchange`.
  - **Thêm**: `POST /auth/switch`.
  - **Sửa**: `GET /auth/google/callback` set cookie + redirect; `GET /auth/accounts` trả kèm trạng thái còn hạn của từng account trên device.
  - **Giữ**: `GET /auth/me`, `GET /auth/devices`, `DELETE /auth/sessions/:id`, `POST /auth/logout`.
- Bỏ DTO `exchange-google-code.dto.ts`, `refresh.dto.ts`. `auth.constants.ts`: bỏ TTL/cookie liên quan refresh & change-token; thêm `SESSION_*`, `DEVICE_COOKIE_*`.

## Frontend — thay đổi (Phase 2, sau BE)

- `api-client.ts`: bỏ interceptor auto-refresh, bỏ Bearer header, bỏ `getUsableAccessToken`/`runRefresh`. Chỉ `withCredentials: true`. 401 → mark account cần relogin / về `/login`.
- `auth-store.ts`: bỏ `accessToken`, `accessTokenExpiresAt`, `isAccessTokenExpired`, `updateAccessToken`. Giữ `accounts` (metadata hiển thị), `activeAccountId`, `accountStatus`.
- `auth-callback.ts`: bỏ parse `code` + schema `accessToken`; trang callback chỉ gọi `/auth/me`.
- `auth-api.ts` / `use-auth-api.ts`: bỏ `refreshAccount`, `fetchAccountsStatus`; thêm `switchAccount`. Switch → gọi `/auth/switch` rồi refetch; account hết hạn hiện nút "đăng nhập lại".

## Bảo mật

- `device_id` cookie **không** đủ để vào account đã hết hạn (phải login lại) → giảm rủi ro lộ cookie.
- Cookie httpOnly + secure(prod) + SameSite=lax. State-change endpoint same-origin.
- Session lưu trong DB → revoke tức thì (khác mô hình JWT cũ vốn có cửa sổ revoke = TTL access token).
- Token chỉ lưu dạng hash; so sánh timing-safe.

## Testing

- Unit: `validateSession` (hợp lệ / hết hạn / revoke / sai device / sliding renew <1d vs >1d).
- Unit: `switchActiveSession` (còn hạn cấp token mới / hết hạn trả lỗi).
- Integration: callback tạo session + set cookie + redirect; request có cookie qua `SessionGuard`; logout revoke; multi-account add + switch; remote revoke.
- Spec viết để verify rồi xoá (không commit spec test).

## Phân kỳ

- **Phase 1 (BE)**: schema + migration, token/session/device service, `SessionGuard`, endpoints, tests. Làm trước.
- **Phase 2 (FE)**: store, api-client, callback, switch UI. Làm sau khi BE xong.
