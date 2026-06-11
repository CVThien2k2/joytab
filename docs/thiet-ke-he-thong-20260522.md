# Thiết kế hệ thống

## 1. Mục tiêu tài liệu
- Thiết kế use case và luồng xử lý cho phạm vi hiện tại: xác thực Google và quản lý phiên đa thiết bị/đa tài khoản.
- Chuẩn hóa hành vi hệ thống trước khi mở rộng các nghiệp vụ khác.

## 2. Phạm vi use case hiện tại
| Mã use case | Tên use case | Actor chính | Kết quả đầu ra |
|---|---|---|---|
| UC-001 | Đăng nhập bằng Google | Người dùng | Tạo phiên đăng nhập hợp lệ |
| UC-002 | Thêm tài khoản vào máy hiện tại | Người dùng | Máy có nhiều tài khoản đã liên kết |
| UC-003 | Chuyển tài khoản trên cùng máy | Người dùng | Đổi phiên hoạt động sang tài khoản khác |
| UC-004 | Xóa tài khoản khỏi máy | Người dùng | Gỡ liên kết tài khoản khỏi thiết bị hiện tại |
| UC-005 | Đăng xuất khỏi các máy khác | Người dùng | Vô hiệu phiên ở các thiết bị khác |

## 3. Sơ đồ use case tổng quát
```mermaid
flowchart LR
  GUEST((Khách mới))
  USER((Người dùng))

  subgraph SYS[Core qua API Gateway]
    UC1([UC-001])
    UC2([UC-002])
    UC3([UC-003])
    UC4([UC-004])
    UC5([UC-005])
  end

  GUEST --> UC1
  USER --> UC2
  USER --> UC3
  USER --> UC4
  USER --> UC5
```

## 3.1 Vai trò API Gateway trong luồng xác thực
- Mọi request từ UI đều đi qua **API Gateway** (cổng public `8000`) trước khi tới **Core** (port nội bộ `8001`).
- Gateway xử lý edge: CORS allowlist, kiểm tra CSRF Origin/Referer, đọc cookie `session_id`, đối chiếu `session:{sha256(token)}` trong Redis, strip header `X-User-*` do client gửi rồi inject identity tin cậy (`X-User-Id`, `X-User-Email`, `X-Session-Id`, `X-Device-Id`).
- `/api` là namespace public duy nhất; gateway strip prefix `/api` rồi forward `/v1/...` sang core (versioning đặt ở cấp controller `v1/auth`, `v1/users`). Route public (`/api/v1/auth/google`, `/api/v1/auth/google/callback`, `/api/v1/auth/switch`, `/api/v1/auth/logout`, `/api/v1/auth/accounts`) đi qua không bắt buộc session; route protected (`/api/v1/auth/me`, `/api/v1/auth/devices`, `/api/v1/auth/sessions/:id`, `/api/v1/users` và mọi `/api/v1/...` khác) thiếu phiên hợp lệ sẽ bị gateway trả 401.
- Core không tự validate cookie nữa mà tin cậy header `X-User-Id` của gateway qua `GatewayUserGuard`. Khi create/refresh/switch, core ghi session vào **cả Redis** (validate nhanh, có TTL) **và Postgres** (nguồn sự thật cho liệt kê device/session, remote revoke, audit); khi logout/revoke thì xóa key Redis.
- Trong các sequence dưới đây, `API as Core` là phần nghiệp vụ phía sau gateway; gateway chỉ được vẽ tách riêng ở các luồng cần làm rõ xác thực edge.

## 4. Luồng chi tiết từng use case

### 4.1 UC-001: Đăng nhập bằng Google
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant GW as API Gateway
  participant API as Core
  participant GG as Google
  participant DB as Database
  participant RD as Redis

  ND->>UI: Chọn đăng nhập Google
  UI->>GW: GET /api/v1/auth/google (route public)
  GW->>API: Proxy /v1/auth/google (không bắt buộc session)
  API->>GG: Redirect sang Google OAuth
  GG-->>API: Callback /api/v1/auth/google/callback + profile (qua gateway)
  alt Callback hợp lệ
    API->>DB: Tạo hoặc cập nhật user
    API->>RD: Lưu one-time mapping code -> email (TTL 60s)
    API-->>UI: Set cookie HttpOnly JWT (change token) + redirect /login/callback?code=...
    UI->>GW: POST /api/v1/auth/google/exchange (code + cookie change token)
    GW->>API: Proxy
    API->>RD: Validate code với email trong JWT, xóa code (one-time)
    API->>DB: Ghi user_session (nguồn sự thật)
    API->>RD: Ghi session:{hash} -> {userId,email,sessionId,deviceId} (TTL)
    API-->>UI: Trả Google user + set cookie HttpOnly session_id
    UI-->>ND: Đăng nhập thành công
  else Credential không hợp lệ
    API-->>UI: Redirect về /login
    UI-->>ND: Hiển thị lỗi đăng nhập
  end
```

### 4.2 UC-002: Thêm tài khoản vào máy hiện tại
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant GW as API Gateway
  participant API as Core
  participant GG as Google
  participant DB as Database

  ND->>UI: Chọn Thêm tài khoản
  UI->>GW: Gửi credential Google mới (route public /api/v1/auth/accounts)
  GW->>API: Proxy
  API->>GG: Xác thực credential
  GG-->>API: Kết quả xác thực
  API->>DB: Kiểm tra account đã liên kết với thiết bị chưa
  alt Chưa liên kết
    API->>DB: Tạo hoặc cập nhật user
    API->>DB: Tạo mapping device_users
    API-->>UI: Trả danh sách tài khoản đã cập nhật
    UI-->>ND: Thêm tài khoản thành công
  else Đã liên kết
    API-->>UI: Trả trạng thái đã liên kết
    UI-->>ND: Thông báo tài khoản đã tồn tại
  end
```

### 4.3 UC-003: Chuyển tài khoản trên cùng máy
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant GW as API Gateway
  participant API as Core
  participant DB as Database
  participant RD as Redis

  ND->>UI: Chọn tài khoản đích
  UI->>GW: Gửi device_id và target_account_id (route public /api/v1/auth/switch)
  GW->>API: Proxy
  API->>DB: Kiểm tra mapping account-device
  alt Tài khoản thuộc thiết bị
    API->>DB: Tạo hoặc đổi user_session active
    API->>RD: Ghi session:{hash} cho phiên mới (TTL)
    API-->>UI: Trả session mới + set cookie session_id
    UI-->>ND: Chuyển tài khoản thành công
  else Không thuộc thiết bị
    API-->>UI: Trả lỗi không hợp lệ
    UI-->>ND: Thông báo chuyển thất bại
  end
```

### 4.4 UC-004: Xóa tài khoản khỏi máy
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant GW as API Gateway
  participant API as Core
  participant DB as Database
  participant RD as Redis

  ND->>UI: Chọn xóa tài khoản khỏi máy
  UI->>GW: Gửi device_id và account_id (route protected)
  GW->>RD: Validate session:{hash} + inject X-User-*
  GW->>API: Proxy kèm identity tin cậy
  API->>DB: Kiểm tra policy account cuối cùng
  alt Được phép xóa
    API->>DB: Hủy session account trên thiết bị hiện tại
    API->>RD: Xóa session:{hash} của account bị gỡ
    API->>DB: Xóa mapping device_users
    API->>DB: Nếu account active thì chuyển account active khác
    API-->>UI: Trả kết quả xóa
    UI-->>ND: Xóa tài khoản thành công
  else Không được phép xóa
    API-->>UI: Trả lỗi không thể xóa account cuối
    UI-->>ND: Hiển thị lỗi
  end
```

### 4.5 UC-005: Đăng xuất khỏi các máy khác
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant GW as API Gateway
  participant API as Core
  participant DB as Database
  participant RD as Redis

  ND->>UI: Chọn đăng xuất khỏi các máy khác
  UI->>GW: Gửi current_device_id (route protected)
  GW->>RD: Validate session:{hash} + inject X-User-*
  GW->>API: Proxy kèm identity tin cậy
  API->>DB: Lấy session active của user
  API->>DB: Lọc session khác current_device
  alt Có session khác
    API->>DB: Revoke các session đã lọc
    API->>RD: Xóa session:{hash} của các phiên đã revoke
    API-->>UI: Trả số lượng session đã revoke
    UI-->>ND: Đăng xuất máy khác thành công
  else Không có session khác
    API-->>UI: Trả số lượng revoke = 0
    UI-->>ND: Không có máy khác đang đăng nhập
  end
```

## 5. Mapping use case -> module hệ thống
| Use case | Module chính | Dữ liệu liên quan |
|---|---|---|
| UC-001 | Auth Module | users, user_sessions |
| UC-002 | Device User Module | devices, device_users, user_sessions |
| UC-003 | Session Switch Module | device_users, user_sessions |
| UC-004 | Device User Module | device_users, user_sessions |
| UC-005 | Session Security Module | user_sessions |

## 6. Quy tắc triển khai cho scope hiện tại
- Chỉ triển khai các API phục vụ UC-001 đến UC-005.
- Chưa triển khai các nghiệp vụ chia tiền/quỹ ở phiên bản này.
- Mọi thay đổi phạm vi phải cập nhật đồng thời tài liệu `Phiên bản`.
