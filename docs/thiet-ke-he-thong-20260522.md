# Thiết kế hệ thống

## 1. Mục tiêu tài liệu
- Thiết kế use case và luồng xử lý cho phạm vi hiện tại: xác thực Google và quản lý phiên đa thiết bị/đa tài khoản bằng **session cookie** (không dùng JWT cho phiên).
- Chuẩn hóa hành vi hệ thống trước khi mở rộng các nghiệp vụ chia tiền/quỹ.

## 2. Mô hình phiên (session model)
- Sau khi Google OAuth thành công, BE tạo `UserSession`, cấp một **token ngẫu nhiên 32 byte** (raw), băm **SHA-256** lưu `user_sessions.token_hash`, và set 2 cookie HttpOnly:
  - `session_id`: chứa token raw (đối chiếu bằng hash), TTL 7 ngày, sliding renew khi còn dưới 1 ngày.
  - `device_id`: chứa UUID `Device`, sống 1 năm để giữ định danh thiết bị qua nhiều phiên.
- Không có access/refresh JWT, không có luồng one-time code exchange. Mọi request bảo vệ chỉ cần gửi kèm 2 cookie trên (`withCredentials`).
- Một thiết bị (`device_id`) có thể liên kết nhiều account (`device_users`); mỗi account có phiên riêng trong `user_sessions`.

## 3. Phạm vi use case hiện tại
| Mã use case | Tên use case | Actor chính | Kết quả đầu ra |
|---|---|---|---|
| UC-001 | Đăng nhập bằng Google | Người dùng | Tạo session hợp lệ, set cookie `session_id`+`device_id` |
| UC-002 | Thêm tài khoản vào máy hiện tại | Người dùng | Liên kết thêm account vào `device_id` hiện tại |
| UC-003 | Chuyển tài khoản active trên cùng máy | Người dùng | Đổi phiên active sang account khác đã link |
| UC-004 | Đăng xuất | Người dùng | Revoke session hiện tại, xóa cookie `session_id` |
| UC-005 | Xem & thu hồi phiên từ xa | Người dùng | Liệt kê thiết bị/phiên, revoke session khác |
| UC-006 | Lấy thông tin user & danh sách account | Người dùng | Trả user hiện tại / account trên device |

## 4. Sơ đồ use case tổng quát
```mermaid
flowchart LR
  GUEST((Khách mới))
  USER((Người dùng))

  subgraph SYS[Service API]
    UC1([UC-001])
    UC2([UC-002])
    UC3([UC-003])
    UC4([UC-004])
    UC5([UC-005])
    UC6([UC-006])
  end

  GUEST --> UC1
  USER --> UC2
  USER --> UC3
  USER --> UC4
  USER --> UC5
  USER --> UC6
```

## 5. Luồng chi tiết từng use case

### 5.1 UC-001: Đăng nhập bằng Google
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant API as Service API
  participant GG as Google
  participant DB as Database

  ND->>UI: Chọn đăng nhập Google
  UI->>API: GET /auth/google
  API->>GG: Redirect sang Google OAuth (scope email, profile)
  GG-->>API: GET /auth/google/callback + profile
  alt Callback hợp lệ (có email)
    API->>DB: Upsert user theo provider_user_id
    API->>DB: ensureDevice (theo cookie device_id hoặc tạo mới) + linkDeviceUser
    API->>DB: Tạo/refresh UserSession, lưu token_hash + expires_at
    API-->>UI: Set cookie session_id + device_id, redirect 302 về FE `/`
    UI->>API: GET /auth/me (kèm cookie)
    API-->>UI: Thông tin user hiện tại
    UI-->>ND: Vào trang chính
  else Thiếu email / lỗi
    API-->>UI: Redirect 302 về `/login`
    UI-->>ND: Hiển thị lỗi đăng nhập
  end
```

### 5.2 UC-002: Thêm tài khoản vào máy hiện tại
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant API as Service API
  participant GG as Google
  participant DB as Database

  ND->>UI: Chọn Thêm tài khoản
  UI->>API: GET /auth/google?prompt=select_account (giữ cookie device_id cũ)
  API->>GG: OAuth với màn chọn account
  GG-->>API: Callback + profile account mới
  API->>DB: Upsert user + linkDeviceUser vào device_id hiện tại (không deactivate account khác)
  API->>DB: Tạo/refresh session cho account mới
  API-->>UI: Set cookie session_id (account mới) + device_id, redirect `/`
  UI-->>ND: Máy có nhiều account, account mới đang active
```

### 5.3 UC-003: Chuyển tài khoản active trên cùng máy
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant API as Service API
  participant DB as Database

  ND->>UI: Chọn account đích trong danh sách
  UI->>API: POST /auth/switch { userId } (cookie device_id)
  API->>DB: Kiểm tra device_users link + tìm session sống của account đích
  alt Account đã link và còn phiên sống
    API->>DB: Cấp token mới cho session đó (rotate token_hash)
    API-->>UI: Set cookie session_id mới, trả { success, userId }
    UI-->>ND: Chuyển account thành công
  else Chưa link hoặc hết phiên
    API-->>UI: AUTH_001 (cần đăng nhập lại account đích)
    UI-->>ND: Điều hướng đăng nhập lại
  end
```

### 5.4 UC-004: Đăng xuất
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant API as Service API
  participant DB as Database

  ND->>UI: Chọn Đăng xuất
  UI->>API: POST /auth/logout (cookie session_id)
  API->>DB: Revoke session theo token_hash (reason = logout)
  API-->>UI: clearCookie session_id (giữ device_id), trả { success }
  UI-->>ND: Về trang login
```

### 5.5 UC-005: Xem & thu hồi phiên từ xa
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant API as Service API
  participant DB as Database

  ND->>UI: Mở danh sách thiết bị đang đăng nhập
  UI->>API: GET /auth/devices (SessionGuard)
  API->>DB: Lấy session sống của user kèm device
  API-->>UI: Danh sách { sessionId, deviceName, platform, lastSeenAt }
  ND->>UI: Chọn thu hồi một phiên
  UI->>API: DELETE /auth/sessions/:id (SessionGuard)
  API->>DB: Revoke session nếu thuộc user (reason = revoked_remote)
  API-->>UI: { success }
  Note over UI,API: Phiên bị thu hồi khi gọi API nghiệp vụ sẽ nhận AUTH_004 → FE bật popup
```

### 5.6 UC-006: Lấy thông tin user & danh sách account
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant API as Service API
  participant DB as Database

  UI->>API: GET /auth/me (SessionGuard)
  API-->>UI: { userId, user }
  UI->>API: GET /auth/accounts (cookie device_id)
  API->>DB: Lấy account đã link + đánh dấu needsRelogin (account hết phiên)
  API-->>UI: Danh sách account cho account switcher
```

## 6. Mapping use case -> thành phần hệ thống
| Use case | Endpoint | Service chính | Dữ liệu liên quan |
|---|---|---|---|
| UC-001 | `GET /auth/google`, `GET /auth/google/callback` | AuthService, DeviceService, SessionService | users, devices, device_users, user_sessions |
| UC-002 | `GET /auth/google` (`prompt=select_account`) | AuthService, DeviceService, SessionService | users, device_users, user_sessions |
| UC-003 | `POST /auth/switch` | SessionService | device_users, user_sessions |
| UC-004 | `POST /auth/logout` | SessionService | user_sessions |
| UC-005 | `GET /auth/devices`, `DELETE /auth/sessions/:id` | SessionService | user_sessions, devices |
| UC-006 | `GET /auth/me`, `GET /auth/accounts` | AuthService, DeviceService, SessionService | users, device_users, user_sessions |

## 7. Bảng endpoint hiện có
| Method & Path | Bảo vệ | Mô tả |
|---|---|---|
| `GET /auth/google` | Public | Bắt đầu OAuth Google. |
| `GET /auth/google/callback` | GoogleAuthGuard | Nhận callback, tạo session, set cookie, redirect FE `/`. |
| `POST /auth/switch` | Cookie `device_id` | Đổi account active trên device. |
| `POST /auth/logout` | Cookie `session_id` | Revoke session hiện tại. |
| `GET /auth/accounts` | Cookie `device_id` | Danh sách account trên device + `needsRelogin`. |
| `GET /auth/me` | SessionGuard | Thông tin user hiện tại. |
| `GET /auth/devices` | SessionGuard | Danh sách thiết bị/phiên của user. |
| `DELETE /auth/sessions/:id` | SessionGuard | Thu hồi phiên từ xa nếu thuộc user. |
| `GET /users` | SessionGuard | `[DEMO]` endpoint nghiệp vụ minh hoạ popup hết phiên. |

## 8. Quy tắc triển khai cho scope hiện tại
- Chỉ triển khai xác thực Google + quản lý phiên (UC-001..006); chưa triển khai nghiệp vụ chia tiền/quỹ.
- Rate limit: global 60 req/60s; nhóm `/auth` giới hạn 10 req/60s.
- Mọi thay đổi phạm vi phải cập nhật đồng thời tài liệu `Phiên bản`.
