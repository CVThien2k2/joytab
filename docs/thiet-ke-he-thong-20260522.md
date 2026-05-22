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

  subgraph SYS[Service API]
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

## 4. Luồng chi tiết từng use case

### 4.1 UC-001: Đăng nhập bằng Google
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant API as Service API
  participant GG as Google
  participant DB as Database

  ND->>UI: Chọn đăng nhập Google
  UI->>API: Gửi authorization code hoặc token
  API->>GG: Xác thực credential
  GG-->>API: Kết quả xác thực
  alt Credential hợp lệ
    API->>DB: Tạo hoặc cập nhật user
    API->>DB: Tạo user_session cho thiết bị hiện tại
    API-->>UI: Trả token hoặc session
    UI-->>ND: Đăng nhập thành công
  else Credential không hợp lệ
    API-->>UI: Trả lỗi xác thực
    UI-->>ND: Hiển thị lỗi đăng nhập
  end
```

### 4.2 UC-002: Thêm tài khoản vào máy hiện tại
```mermaid
sequenceDiagram
  actor ND as Người dùng
  participant UI
  participant API as Service API
  participant GG as Google
  participant DB as Database

  ND->>UI: Chọn Thêm tài khoản
  UI->>API: Gửi credential Google mới
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
  participant API as Service API
  participant DB as Database

  ND->>UI: Chọn tài khoản đích
  UI->>API: Gửi device_id và target_account_id
  API->>DB: Kiểm tra mapping account-device
  alt Tài khoản thuộc thiết bị
    API->>DB: Tạo hoặc đổi user_session active
    API-->>UI: Trả session mới
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
  participant API as Service API
  participant DB as Database

  ND->>UI: Chọn xóa tài khoản khỏi máy
  UI->>API: Gửi device_id và account_id
  API->>DB: Kiểm tra policy account cuối cùng
  alt Được phép xóa
    API->>DB: Hủy session account trên thiết bị hiện tại
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
  participant API as Service API
  participant DB as Database

  ND->>UI: Chọn đăng xuất khỏi các máy khác
  UI->>API: Gửi current_device_id
  API->>DB: Lấy session active của user
  API->>DB: Lọc session khác current_device
  alt Có session khác
    API->>DB: Revoke các session đã lọc
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
