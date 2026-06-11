# API Gateway + SSO (edge auth qua Redis) — Design

- Ngày: 2026-06-11
- Trạng thái: Draft (chờ user review)
- Nhánh làm việc: `sso`

> Đây là artifact quy trình brainstorming, KHÔNG phải docs sản phẩm Zensical trong `docs/*.md`.
> Docs sản phẩm sẽ được cập nhật riêng theo rule dự án khi triển khai.

## 1. Mục tiêu

Đưa `api-gateway` (đã scaffold NestJS) thành cổng public duy nhất, "bắt mạng" mọi
request và làm điểm xác thực (edge auth). Service auth hiện tại (`api`) đổi tên thành
`sso`, chỉ phục vụ login/cấp phiên/quản lý device và (về lâu dài) chỉ gateway gọi tới.
Chuẩn bị nền cho các business service downstream sau này.

## 2. Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Mô hình auth | Edge auth tại gateway |
| Cách validate | Gateway đọc **thẳng Redis** (không introspection mỗi request) |
| Service auth | `api` → đổi tên **`sso`** |
| Session store | **Redis** (validate nhanh) + **Postgres** (source of truth: device/list/revoke/audit) |
| Cô lập SSO | Network isolation — **để dành cho đợt dockerize sau** (đợt này local chỉ tách port) |
| Proxy tech | NestJS + **`http-proxy-middleware`** |
| Ports | Gateway = **8000** (public, FE đang gọi sẵn), SSO = **8001** (nội bộ) |
| Google callback | `redirect_uri` dựng từ `API_URL=http://localhost:8000` = gateway → KHÔNG đổi Google Console |
| SSO endpoint bảo vệ | **Tin header `X-User-Id`** từ gateway (không tự validate cookie) |

## 3. Kiến trúc

```
                    ┌─────────────────────────────────────────┐
 Browser ──public──▶│  API Gateway (NestJS) :8000              │
 (chỉ thấy gateway) │  • Edge: CORS, CSRF, rate-limit, cookie  │
                    │  • Auth: đọc session Redis → inject       │
                    │          X-User-* ; strip header giả mạo │
                    └───┬───────────────┬──────────────┬───────┘
                        │               │              │ (sau này)
                        ▼               ▼              ▼
                   ┌─────────┐     ┌────────┐    ┌──────────────┐
                   │  SSO    │     │ Redis  │◀───│ business svcs │
                   │ :8001   │────▶│session │    │  (tương lai)  │
                   │ login,  │     └────────┘    └──────────────┘
                   │ OAuth,  │     ┌────────┐
                   │ device  │────▶│Postgres│ (source of truth)
                   └─────────┘     └────────┘
```

- Đợt này KHÔNG dockerize, KHÔNG đổi FE. Cô lập mạng thật để đợt sau.
- Cookie set bởi SSO, chảy ngược qua gateway; trên localhost cookie không phân biệt port
  nên dùng chung giữa gateway:8000 và FE:3000 bình thường.

## 4. Phân vai

| Thành phần | Trách nhiệm |
|---|---|
| **Gateway** :8000 | Cổng public. Edge: CORS/CSRF/rate-limit/cookie-domain. Validate session đọc Redis. Inject identity header + strip header giả mạo. Proxy `/auth/*`, `/api/*` → SSO. |
| **SSO** :8001 | Google OAuth login; cấp/refresh session (ghi **cả** Redis + Postgres); quản lý device/account; revoke. Endpoint bảo vệ tin header gateway. |
| **Redis** | `session:{token_hash}` → `{userId,email,sessionId,deviceId}`, TTL = SESSION_TTL. |
| **Postgres** | `user_session`/`device`: list thiết bị, revoke từ xa, audit (source of truth). |

## 5. Luồng request

### A. Login (Google OAuth) — route auth là "public", gateway proxy thẳng
1. Browser → Gateway `/auth/google` → proxy SSO → redirect Google.
2. Google callback `http://localhost:8000/auth/google/callback` → Gateway → proxy SSO.
3. SSO upsert user, tạo session:
   - ghi Postgres `user_session` (durable),
   - ghi Redis `session:{token_hash}` (TTL),
   - `Set-Cookie session_id/device_id` chảy ngược qua gateway về browser.
4. SSO redirect về FE home (qua gateway).

### B. Request đã đăng nhập — gateway tự validate
1. Browser → Gateway `/api/...` kèm cookie `session_id` + `device_id`.
2. Gateway đọc Redis `session:{hash(session_id)}`:
   - miss/hết hạn → 401 (AUTH_001/005),
   - hit → khớp `device_id`, sliding-renew TTL Redis nếu dưới ngưỡng.
3. Gateway **strip** mọi `X-User-*` từ client (chống giả mạo), inject:
   `X-User-Id`, `X-User-Email`, `X-Session-Id`, `X-Device-Id`.
4. Proxy sang downstream. Downstream **tin** header.

### C. Revoke / logout
- Gateway proxy `/auth/logout`, `DELETE /auth/sessions/:id` sang SSO (kèm cookie).
- SSO: update Postgres `is_revoked` + **xóa Redis key** tương ứng (tra `token_hash` từ `user_session`).

## 6. Hạng mục triển khai

### Gateway (xây trên scaffold sẵn)
- Cài + cấu hình `http-proxy-middleware`, mount theo prefix → `SSO_URL` (`http://localhost:8001`).
- `RedisSessionService`: đọc session theo `token_hash`, sliding-renew TTL. Dùng chung "contract" key với SSO.
- `GatewayAuthGuard`/middleware: validate route bảo vệ, inject/strip identity header; route auth login/callback = public bypass.
- Edge: CORS allowlist + CSRF (Origin/Referer) + rate-limit + cookie domain — **chuyển từ `api`**.
- Config: `PORT=8000`, `SSO_URL`, `REDIS_*`, `CORS_ALLOWED_ORIGINS`, `COOKIE_DOMAIN`.

### SSO (đổi tên từ `api`)
- Rename folder/package `api` → `sso`; cập nhật script/import/đường dẫn liên quan.
- `SessionService`: create/refresh → ghi thêm Redis key (TTL); revoke → xóa Redis key.
- Endpoint bảo vệ (`/auth/me`, `/devices`, `/sessions/:id`): đổi `SessionGuard`
  (cookie→Postgres) sang **`GatewayUserGuard`** đọc `X-User-Id` (internal-only nên an toàn).
- Gỡ CORS/CSRF khỏi SSO (không còn browser-facing); vẫn giữ set cookie.
- `PORT=8001`; `API_URL=http://localhost:8000` (gateway, để dựng OAuth redirect_uri).

### Không đụng tới đợt này
- Docker / docker-compose.
- FE (vẫn gọi `:8000`).
- Google Console.

## 7. "Session contract" (Redis) — nguồn dùng chung gateway ↔ SSO

- Key: `session:{token_hash}` với `token_hash = sha256(raw session_id cookie)`.
- Value (JSON): `{ userId, email, sessionId, deviceId }`.
- TTL: `SESSION_TTL_MS`; sliding-renew khi còn dưới `SESSION_RENEW_THRESHOLD_MS`.
- Ghi: SSO lúc create/refresh. Xóa: SSO lúc logout/revoke.
- Đọc + renew TTL: gateway mỗi request bảo vệ.
- Tạm thời mỗi bên tự định nghĩa format giống nhau (chưa tách shared package — YAGNI),
  ghi rõ tại mục này để đồng bộ.

## 8. Error handling
- Gateway: session miss/expired → 401 dùng cùng format `ERROR_CODES` hiện có
  (AUTH_001/AUTH_005). CSRF chặn → AUTH_006 (403). CORS từ chối → lỗi CORS chuẩn.
- SSO: thiếu `X-User-Id` ở route bảo vệ → AUTH_001.

## 9. Ngoài phạm vi (YAGNI)
- Business service downstream mới.
- mTLS / shared-secret giữa gateway ↔ SSO (dựa network isolation đợt dockerize sau).
- Tách shared package cho session contract.

## 10. Rủi ro / lưu ý
- Local chưa ép được "SSO chỉ gateway gọi" (đều `localhost`) — chấp nhận, hardening ở đợt docker.
- Đổi tên `api` → `sso` đụng nhiều import/đường dẫn/script → cần làm cẩn thận, build lại.
- Phần CORS/CSRF vừa thêm ở branch `sso` (trong `api`) sẽ di dời sang gateway (tái dùng, không bỏ phí).
- Cần đảm bảo gateway forward đúng `Set-Cookie` và redirect 302 của luồng OAuth.
