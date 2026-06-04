# FE Auth cơ bản — Thiết kế

Ngày: 2026-06-04
Phạm vi: nối FE (Next.js 16 / `ui/`) với các API auth đã có ở BE để dùng được các tính năng cơ bản. UI tối giản, chưa cần đẹp.

## Hiện trạng đã có
- Login → redirect BE `/auth/google`; callback exchange code → lưu session vào Zustand (persist localStorage).
- `(private)` layout chặn route; `(auth)` layout chặn ngược.
- Home hiển thị user + nút đăng xuất (chỉ clear local).

## Khoảng trống cần làm
1. `api-client` chưa gắn Bearer token → endpoint protected sẽ 401.
2. Logout chỉ clear local, chưa revoke BE.
3. Chưa auto-refresh khi access token hết hạn.
4. Chưa dùng các API: refresh, switch, accounts, devices, revoke session.

## Thiết kế

### 1. `src/lib/api-client.ts` — 2 interceptor
- **Request**: gắn `Authorization: Bearer <accessToken>` đọc từ `useAuthStore.getState()`.
- **Response (401)**: gọi `/auth/refresh` đúng 1 lần (dùng chung `refreshPromise` khi nhiều request 401 đồng thời) → cập nhật access token mới vào store → retry request gốc với token mới. Refresh fail → clear store + `window.location = /login`.
- Chống loop: cờ `config._retry`; không refresh cho `/auth/refresh` và `/auth/google/exchange`.
- Refresh gọi qua `axios` trực tiếp (không qua instance) để tránh đệ quy interceptor; chỉ dựa vào cookie (`withCredentials`).

### 2. `src/stores/auth-store.ts`
- Thêm `updateAccessToken(accessToken, accessTokenExpiresAt)` (merge vào session hiện tại) cho refresh.
- Switch dùng lại `loginWithSession(session)`.

### 3. `src/lib/auth-callback.ts` (refactor nhẹ)
- Tách & export `authSessionSchema` (phần `data`) để switch dùng lại.

### 4. `src/lib/auth-api.ts` (mới)
Gom hàm gọi + zod schema, parse theo envelope `{ success, message, data }`:
- `switchAccount(targetUserId)` → `AuthSession`
- `logoutRequest()`
- `fetchAccounts()` → `{ userId, email, fullName, avatarUrl, isActive }[]`
- `fetchDevices()` → `{ sessionId, deviceId, deviceName, platform, lastSeenAt, createdAt }[]`
- `revokeSession(sessionId)`
Mọi call `/auth/*` dùng cookie refresh đặt `withCredentials: true`.

### 5. `src/hooks/` — react-query
`useLogout`, `useAccounts`, `useSwitchAccount`, `useDevices`, `useRevokeSession`.
- Switch success → `loginWithSession` + invalidate `['accounts']`.
- Revoke success → invalidate `['devices']`.

### 6. UI — gộp vào home `(private)` (chưa cần đẹp)
- Khối "Tài khoản trên thiết bị": list accounts + nút Switch (account active disable).
- Khối "Thiết bị / phiên": list devices + nút Revoke.
- Nút Đăng xuất: `useLogout` (BE logout rồi clear store).

## Xác minh
- `npm run build` + `npm run lint` sạch.
- Boot `next dev` + BE, đăng nhập Google, kiểm tra: token gắn vào request, refresh khi 401, switch/logout/devices/revoke hoạt động.
