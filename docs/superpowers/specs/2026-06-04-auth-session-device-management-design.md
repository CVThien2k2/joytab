# Thiết kế: Quản lý phiên đăng nhập, thiết bị và multi-account

- **Ngày:** 2026-06-04
- **Phạm vi:** `api/` (NestJS + Prisma + PostgreSQL + Redis)
- **Mục tiêu:** Hoàn thiện luồng login để persist dữ liệu xuống DB (device, session, refresh token), hỗ trợ quản lý thiết bị, đăng nhập nhiều tài khoản trên 1 máy, chuyển tài khoản tức thì, và revoke phiên khi có dấu hiệu bị lộ.

---

## 1. Hiện trạng & khoảng trống

Luồng login hiện tại (Google OAuth + one-time code exchange) chỉ:

- `upsert` bảng `users`.
- Lưu refresh token hash vào **Redis** (`auth:refresh:hash:<hash>` → userId), TTL 7 ngày.

Chưa triển khai:

- Không ghi `Device`, `DeviceUser`, `UserSession` (các model đã có sẵn trong schema nhưng không được code dùng).
- Không nhận device fingerprint từ FE.
- Không có endpoint `refresh`, `logout`, `switch`, list devices/accounts, revoke.
- Không có reuse detection / revoke theo phiên.

## 2. Quyết định thiết kế (đã chốt)

| Hạng mục | Quyết định |
|---|---|
| Định danh thiết bị | **Kết hợp**: FE gửi `deviceFingerprint` ổn định; backend bổ sung `platform`/User-Agent để hiển thị tên thiết bị. |
| Multi-account / switch | **Giữ nhiều session sống, switch tức thì** (không login lại), N account link 1 máy, 1 account `is_active` tại một thời điểm. |
| Neo tin cậy cho switch | **Option A**: refresh token của account đang active là bằng chứng sở hữu thiết bị. Không thêm cookie device riêng. |
| Nguồn sự thật refresh/session | **C1**: PostgreSQL là nguồn sự thật duy nhất. Redis chỉ giữ one-time login code (giữ nguyên). |
| Vòng đời refresh token | **Rotation + reuse detection** theo mô hình "token family" (`user_sessions` ↔ `refresh_tokens`). |

### Nguyên tắc bảo mật

- Chỉ lưu **hash SHA-256** của refresh token (không lưu plaintext) — giữ nguyên cơ chế `TokenService.hashToken` hiện có.
- So sánh hash bằng `timingSafeEqual` (đã có `safeCompareHash`).
- Cookie refresh token: `HttpOnly`, `SameSite=lax`, `Secure` ở production, `path=/auth`.
- Access token là JWT HS256 ngắn hạn (1h, stateless) — không lưu DB, không revoke trực tiếp; revoke tác động qua refresh.

## 3. Thay đổi schema (Prisma + migration)

`UserSession` được tái cấu trúc thành "phiên/họ token", và tách `refresh_token_hash` ra bảng mới `refresh_tokens` để hỗ trợ rotation + reuse detection.

### 3.1. `UserSession` (sửa)

```prisma
model UserSession {
  id             String         @id @default(uuid()) @db.Uuid
  user_id        String         @db.Uuid
  device_id      String         @db.Uuid
  is_revoked     Boolean        @default(false)
  revoked_at     DateTime?      @db.Timestamptz(6)
  revoke_reason  String?        @db.VarChar(100)  // 'logout' | 'reuse_detected' | 'revoked_remote' | 'expired'
  last_used_at   DateTime?      @db.Timestamptz(6)
  expires_at     DateTime       @db.Timestamptz(6) // tuổi thọ tuyệt đối của phiên
  created_at     DateTime       @default(now())    @db.Timestamptz(6)
  updated_at     DateTime       @updatedAt         @db.Timestamptz(6)
  user           User           @relation(fields: [user_id], references: [id])
  device         Device         @relation(fields: [device_id], references: [id])
  refresh_tokens RefreshToken[]

  @@index([user_id, is_revoked])
  @@index([device_id, is_revoked])
  @@map("user_sessions")
}
```

**Bỏ** các cột: `refresh_token_hash`, `access_expires_at`, `refresh_expires_at`.

### 3.2. `RefreshToken` (mới)

```prisma
model RefreshToken {
  id             String      @id @default(uuid()) @db.Uuid
  session_id     String      @db.Uuid
  token_hash     String      @unique
  expires_at     DateTime    @db.Timestamptz(6)
  used_at        DateTime?   @db.Timestamptz(6)  // set khi token đã bị xoay vòng → dùng để bắt reuse
  is_revoked     Boolean     @default(false)
  replaced_by_id String?     @db.Uuid            // id token kế tiếp trong chuỗi (audit)
  created_at     DateTime    @default(now())     @db.Timestamptz(6)
  session        UserSession @relation(fields: [session_id], references: [id])

  @@index([session_id])
  @@map("refresh_tokens")
}
```

### 3.3. `Device`, `DeviceUser` — giữ nguyên

Schema sẵn có đã đủ. `DeviceUser` giữ ràng buộc `@@unique([device_id], where: { is_active: true })` (chỉ 1 account active/máy).

## 4. Data flow

### 4.1. Login — exchange (sửa endpoint hiện có)

`POST /auth/google/exchange` — DTO bổ sung `deviceFingerprint`, `deviceName?`.

```
exchange { code, deviceFingerprint, deviceName? } + cookie google_change_token
  ─ validate code + change token (giữ nguyên logic hiện tại)
  ─ transaction:
      ├─ upsert Device(by device_fingerprint): cập nhật platform (parse từ User-Agent),
      │     device_name (nếu FE gửi), last_seen_at=now
      ├─ upsert DeviceUser(device, user): is_active=true
      │     + set is_active=false cho mọi DeviceUser khác cùng device (đảm bảo partial unique)
      ├─ tạo UserSession { user, device, expires_at = now + 7d }
      └─ tạo RefreshToken { session, token_hash, expires_at = now + 7d }
  ─ set cookie refresh_token (raw), path=/auth, TTL 7d
  ─ trả { accessToken, accessTokenExpiresAt, user }
```

> Redis `auth:refresh:hash:` **không còn dùng** — bỏ.

### 4.2. Refresh + reuse detection

`POST /auth/refresh` — cookie `refresh_token`.

```
─ đọc cookie refresh_token; thiếu → AUTH_001
─ hash → tìm RefreshToken theo token_hash
   ├─ không thấy                                    → AUTH_004
   ├─ thấy & (used_at != null | is_revoked | session.is_revoked | session hết hạn)
   │      → 🚨 REUSE/INVALID: revoke session (is_revoked=true, reason='reuse_detected'),
   │        revoke toàn bộ refresh_tokens của session, clear cookie → AUTH_005
   └─ thấy & active & chưa hết hạn:
          ├─ tạo RefreshToken mới (cùng session_id, expires_at giữ theo session.expires_at)
          ├─ token cũ: used_at=now, replaced_by_id=<new>
          ├─ session.last_used_at=now; Device.last_seen_at=now
          ├─ set cookie refresh_token=mới
          └─ trả { accessToken, accessTokenExpiresAt }
```

### 4.3. Switch account (tức thì)

`POST /auth/switch { targetUserId }` — cookie `refresh_token` (của account active).

```
─ validate refresh_token active (như 4.2, không rotate) → suy ra session → device_id  [neo tin cậy]
─ check DeviceUser(device, target) tồn tại & user.status='active'
─ tìm UserSession(device, target) chưa revoke & chưa hết hạn
     ├─ không có session sống cho target  → AUTH_006 (FE điều hướng login lại account đó)
     └─ có:
         ├─ rotate refresh token của session target (như 4.2) → set cookie = target
         ├─ DeviceUser: target.is_active=true, các account khác cùng device=false
         └─ trả { accessToken, accessTokenExpiresAt, user(target) }
```

### 4.4. Logout

`POST /auth/logout` — cookie `refresh_token`.

```
─ tìm session theo refresh token → is_revoked=true, reason='logout'
─ revoke toàn bộ refresh_tokens của session; DeviceUser.is_active=false
─ clear cookie refresh_token
─ (tùy chọn) nếu còn account khác link cùng device → trả gợi ý account kế để FE auto-switch
```

### 4.5. Liệt kê & revoke từ xa

- `GET /auth/accounts` — input: device (suy từ refresh active). Trả danh sách account link với máy hiện tại (id, email, fullName, avatar, is_active) → UI account switcher.
- `GET /auth/devices` — input: user (từ access token guard). Trả danh sách thiết bị + session của user (device_name, platform, last_seen_at, session id, is_active, created_at) → UI "thiết bị đang đăng nhập".
- `DELETE /auth/sessions/:id` — yêu cầu access token guard; chỉ revoke session thuộc về user gọi. Set `is_revoked=true`, reason `'revoked_remote'`, revoke refresh_tokens; nếu là session của chính thiết bị hiện tại thì cũng clear cookie.

## 5. API contract (tóm tắt)

| Method | Path | Auth | Body / Param | Trả về |
|---|---|---|---|---|
| GET | `/auth/google` | — | — | redirect Google |
| GET | `/auth/google/callback` | guard google | — | redirect FE `/login/callback?code=` + cookie change_token |
| POST | `/auth/google/exchange` | cookie change_token | `{ code, deviceFingerprint, deviceName? }` | `{ accessToken, accessTokenExpiresAt, user }` + cookie refresh |
| POST | `/auth/refresh` | cookie refresh | — | `{ accessToken, accessTokenExpiresAt }` + cookie refresh (rotated) |
| POST | `/auth/switch` | cookie refresh | `{ targetUserId }` | `{ accessToken, accessTokenExpiresAt, user }` + cookie refresh |
| POST | `/auth/logout` | cookie refresh | — | `{ success }` + clear cookie |
| GET | `/auth/accounts` | cookie refresh | — | `{ accounts: [...] }` |
| GET | `/auth/devices` | access token | — | `{ devices: [...] }` |
| DELETE | `/auth/sessions/:id` | access token | param `id` | `{ success }` |

Tất cả bọc trong `ApiSuccessResponse<T>` / `ApiErrorResponse` sẵn có.

## 6. Cấu trúc code

Tách trách nhiệm để mỗi unit nhỏ, test độc lập được:

- `auth/session.service.ts` (mới) — vòng đời `UserSession` + `RefreshToken`: tạo, rotate, reuse detection, revoke (session/family), truy vấn list. Phụ thuộc `DatabaseService`, `TokenService`.
- `auth/device.service.ts` (mới) — upsert Device (parse platform từ User-Agent), upsert/activate DeviceUser, query accounts theo device. Phụ thuộc `DatabaseService`.
- `auth/auth.service.ts` (sửa) — orchestrate login/exchange/switch/logout dùng 2 service trên; bỏ logic Redis refresh hash.
- `auth/auth.controller.ts` (sửa) — thêm routes refresh/switch/logout/accounts/devices/sessions; chuẩn hóa cookie options (đã có `buildCookieOptions`).
- `auth/token.service.ts` (giữ) — tái dùng create/hash/compare; cookie `refresh_token` path đổi `/` → `/auth`.
- `auth/dto/` — thêm `exchange` (mở rộng), `switch-account.dto.ts`.
- `common/guards/access-token.guard.ts` (mới) — verify JWT access token cho các route cần đăng nhập (`/auth/devices`, `/auth/sessions/:id`).
- `auth/auth.utils.ts` (sửa) — helper parse platform từ User-Agent; hằng số TTL/cookie.

Thao tác đa bảng (exchange, switch, logout, reuse-revoke) chạy trong **transaction Prisma** để đảm bảo nhất quán partial-unique `is_active`.

## 7. Error codes (bổ sung)

Thêm vào `error-codes.constant.ts`:

| Code | Message |
|---|---|
| `AUTH_004` | `Refresh token invalid` |
| `AUTH_005` | `Session revoked due to suspicious activity` |
| `AUTH_006` | `No active session for target account on this device` |

(`AUTH_001` dùng cho thiếu/không hợp lệ access token; `AUTH_003` giữ cho login code.)

## 8. Thay đổi cấu hình / FE contract

- **FE phải gửi `deviceFingerprint`** (ổn định, vd FingerprintJS hoặc UUID lưu `localStorage`) ở request `exchange`. Các request refresh/switch dựa vào cookie nên không cần gửi lại.
- Cookie `refresh_token` đổi `path` `/` → `/auth` (chỉ gửi tới nhóm route auth).
- Không thêm biến môi trường mới.

## 9. Test plan

Unit:
- `SessionService`: tạo session+token; rotate (token cũ `used_at`, token mới active); reuse detection (token đã used → revoke cả family); revoke session set reason đúng; query loại bỏ session revoked/expired.
- `DeviceService`: upsert device idempotent theo fingerprint; activate DeviceUser đảm bảo chỉ 1 active/máy; parse platform từ User-Agent.

Integration (e2e Nest):
- exchange → tạo đủ Device/DeviceUser/UserSession/RefreshToken, set cookie.
- refresh → rotate, cookie đổi, token cũ bị reject lần 2 (reuse → AUTH_005).
- switch → đổi is_active, cookie đổi sang target, account cũ inactive.
- logout → session revoked, cookie cleared.
- 2 account/1 device → list accounts trả cả 2, đúng cờ active.
- revoke remote → session bị revoke không refresh được nữa.

## 10. Ngoài phạm vi (YAGNI)

- Redis cache cho refresh validation (C2) — chỉ thêm khi có vấn đề hiệu năng.
- Cookie device riêng / Option B — chỉ khi cần switch lúc không account nào active hoặc revoke toàn-device độc lập account.
- Giới hạn cứng số account/máy (như ChatGPT giới hạn 2) — hiện cho N.
- Email/password hay provider khác ngoài Google.
