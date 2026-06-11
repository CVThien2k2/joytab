# Spec: Gateway thành proxy thuần — chuyển edge-auth về core (cache-aside)

- Ngày: 2026-06-11
- Trạng thái: Approved (design)
- Liên quan: [[api-gateway-routing]], `docs/project-error-codes-20260522.md`

## 1. Bối cảnh & vấn đề

Hiện tại gateway làm **edge-auth**: validate session qua Redis (fast path), fallback gọi
`POST /v1/auth/introspect` của core khi Redis miss (cache-aside), rồi inject header
`X-User-*` xuống core. Core tin header đó qua `GatewayUserGuard` — **không tự validate cookie**.

Yêu cầu: gateway trở thành **proxy thuần** ("dùng proxy mặc định"), bỏ `introspect` custom
fetch. Hệ quả bắt buộc: việc validate session phải **chuyển về core**, nếu không mọi Redis
miss sẽ thành 401 (đăng xuất hàng loạt).

## 2. Mục tiêu

- Gateway: chỉ còn Helmet · CORS · CSRF · Proxy. Không Redis, không auth middleware, không introspect.
- Core: tự validate `session_id` + `device_id` từ cookie trên mọi route bảo vệ, theo **cache-aside**
  (Redis trước, DB fallback + rehydrate) — giữ nguyên hiệu năng như edge-auth cũ.
- Core là single source of truth cho auth; không còn phụ thuộc "gateway phải strip header giả".

## 3. Phi mục tiêu

- Không đổi schema DB, không migrate dữ liệu Redis (giữ key `session:{sha256(token)}`).
- Không đụng luồng login Google OAuth, switch account, logout.
- Không refactor ngoài phạm vi auth.

## 4. Thiết kế

### 4.1 Luồng mới

```
Client ──cookie──> Gateway [Helmet · CORS · CSRF · Proxy] ──forward nguyên cookie──> Core
                                                                                      │
                                       Core: SessionCookieGuard (cache-aside)         │
                                       Redis getSession → miss → DB validateSession → rehydrate
                                       set req.userId/req.userEmail → handler
```

### 4.2 CORE

**a. `SessionRedisService` — thêm đường đọc** (hiện chỉ `putSession`/`deleteSession`):
- `getSession(tokenHash): Promise<SessionPayload | null>`: đọc `session:{hash}`, `JSON.parse`,
  sliding-renew TTL khi dưới `SESSION_RENEW_THRESHOLD_MS` (port logic từ gateway
  `SessionStoreService.validate` cũ). Lỗi parse → `null`.

**b. `SessionCookieGuard` (mới) — thay `GatewayUserGuard`:**
- Đọc `session_id` (rawToken) + `device_id` từ cookie (dùng `readCookieValue` sẵn có).
- Thiếu rawToken / `device_id` không phải UUID → `AUTH_001`.
- Cache-aside:
  - `hash = tokenService.hashToken(rawToken)`; `cached = getSession(hash)`.
  - Hit + `cached.deviceId === device_id` → set `req.userId` = cached.userId, `req.userEmail`. Qua.
  - Miss (hoặc Redis lỗi → try/catch, coi như miss) → `sessionService.validateSession(rawToken, deviceId)`
    (DB + rehydrate) → set `req.userId`. Ném `AUTH_001/004/005` y như cũ.
- Áp cho: `GET /v1/auth/me`, `GET /v1/auth/devices`, `DELETE /v1/auth/sessions/:id`.
- Handler giữ nguyên chữ ký `request.userId` → chỉ đổi `@UseGuards(GatewayUserGuard)` → `@UseGuards(SessionCookieGuard)`.

**c. Xóa `/introspect`:** `@Post('introspect')` ở controller + `authService.introspect` — chỉ gateway gọi.

**d. Xóa `GatewayUserGuard`** sau khi không còn route nào dùng.

### 4.3 GATEWAY (thin proxy)

- **Xóa:** `auth/gateway-auth.middleware.ts`, `auth/introspect.service.ts`, `auth/auth-paths.ts`
  (public-path chỉ phục vụ auth middleware), `session/` (store + module + constants).
- `app.module.ts`: bỏ import `SessionStoreModule`, provider `IntrospectService`, bỏ
  `GatewayAuthMiddleware` khỏi chuỗi → `consumer.apply(CsrfMiddleware, ProxyMiddleware).forRoutes('/api')`.
- **Bỏ strip header `X-User-*`**: core không còn tin header → không cần.
- **Giữ:** Helmet, CORS, `CsrfMiddleware` (origin-based edge), `ProxyMiddleware`, `/health`.
- Proxy forward cookie mặc định (http-proxy-middleware forward toàn bộ header).
- Gateway không còn cần Redis → có thể bỏ env `REDIS_*` khỏi gateway (cập nhật docs env).

## 5. Error handling

- `SYS_502/503/504` ở gateway giờ chỉ áp cho **proxy path** (core unreachable/timeout khi forward).
  Nhánh introspect biến mất.
- Core trả `AUTH_001/004/005` trực tiếp cho route bảo vệ (đã có envelope chuẩn qua filter core).
- Cập nhật `docs/project-error-codes-20260522.md`: ghi chú introspect-path không còn.

## 6. Edge cases

- **Redis sập:** `getSession` throw → guard try/catch → fallback DB `validateSession` → không 500.
- **Logout/revoke:** core đã `deleteSession` Redis → cache-aside tự nhất quán.
- **Header giả từ client:** core validate cookie, phớt lờ `X-User-*` → an toàn dù không strip.
- **Sai device:** cache hit nhưng device mismatch → coi như miss → DB validate → `AUTH_001`.

## 7. Test

- Core (`SessionCookieGuard`): hit-cache / miss→DB / revoked `AUTH_004` / expired `AUTH_005` /
  sai device `AUTH_001` / thiếu cookie `AUTH_001` / Redis-down→fallback-DB.
- Core (`SessionRedisService.getSession`): hit / miss / parse lỗi / sliding-renew.
- Gateway: proxy forward cookie xuống core; CSRF chặn mutation origin lạ `AUTH_006`; route public qua được.

## 8. Rollout

- Deploy core trước (thêm guard, vẫn còn `/introspect` tạm trong 1 nhịp nếu cần zero-downtime),
  rồi deploy gateway (bỏ introspect). Hoặc deploy đồng thời nếu chấp nhận downtime ngắn.
- Đơn giản nhất cho repo này: đổi đồng thời (cùng PR), 2 service restart.
