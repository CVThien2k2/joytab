# Thiết kế database

## 1. Mục tiêu tài liệu
- Thiết kế dữ liệu cho scope hiện tại: Google login và quản lý phiên đa thiết bị.
- Chuẩn hóa nguyên tắc: `1 user = 1 account` (không có mô hình một user nhiều account).

## 2. Công nghệ và chiến lược lưu trữ
- DB engine: PostgreSQL.
- Chiến lược migration: migration theo phiên bản schema (quản lý bởi backend).
- Chiến lược backup/restore: backup định kỳ theo chính sách hạ tầng.

## 3. Danh sách bảng chính
| Bảng | Mục đích | Khóa chính | Quan hệ chính |
|---|---|---|---|
| `users` | Lưu hồ sơ user và account Google đăng nhập | `id` | 1-n với `user_sessions`, `device_users` |
| `devices` | Lưu thông tin thiết bị đăng nhập | `id` | 1-n với `device_users`, `user_sessions` |
| `device_users` | Mapping nhiều user trên một thiết bị | `id` | n-1 với `users`, n-1 với `devices` |
| `user_sessions` | Lưu phiên đăng nhập theo user/device | `id` | n-1 với `users`, n-1 với `devices` |

## 4. Thiết kế chi tiết từng bảng

### 4.1 Bảng `users`
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `id` | uuid | PK | Định danh người dùng |
| `provider` | varchar(30) | NOT NULL, default `google` | Nguồn đăng nhập OAuth |
| `provider_user_id` | varchar(255) | UNIQUE, NOT NULL | Subject ID từ Google |
| `email` | varchar(255) | UNIQUE, NOT NULL | Email đăng nhập chính |
| `email_verified` | boolean | NOT NULL, default `false` | Trạng thái xác thực email từ Google |
| `full_name` | varchar(255) | NULL | Tên hiển thị |
| `avatar_url` | text | NULL | Ảnh đại diện |
| `last_login_at` | timestamptz | NULL | Lần đăng nhập gần nhất |
| `status` | varchar(30) | NOT NULL, default `active` | Trạng thái user |
| `created_at` | timestamptz | NOT NULL | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL | Thời điểm cập nhật |
| `is_deleted` | boolean | NOT NULL, default `false` | Cờ xóa mềm |
| `deleted_by` | uuid | NULL | Người thao tác xóa mềm |
| `deleted_at` | timestamptz | NULL | Thời điểm xóa mềm |

### 4.2 Bảng `devices`
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `id` | uuid | PK | Định danh thiết bị nội bộ, lưu trong cookie `device_id` |
| `device_name` | varchar(255) | NULL | Tên hiển thị thiết bị (parse từ user-agent) |
| `platform` | varchar(50) | NULL | Web/Android/iOS/Desktop (parse từ user-agent) |
| `last_seen_at` | timestamptz | NULL | Lần hoạt động gần nhất |
| `created_at` | timestamptz | NOT NULL | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL | Thời điểm cập nhật |

> Không còn cột `device_fingerprint`: định danh thiết bị dựa trên UUID `id` lưu ở cookie `device_id` (sống 1 năm), tạo mới khi thiếu/không hợp lệ.

### 4.3 Bảng `device_users`
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `id` | uuid | PK | Định danh mapping |
| `device_id` | uuid | FK -> `devices.id`, NOT NULL | Thiết bị |
| `user_id` | uuid | FK -> `users.id`, NOT NULL | User trên thiết bị |
| `is_active` | boolean | NOT NULL, default `false` | Cờ user đang active trên máy |
| `linked_at` | timestamptz | NOT NULL | Thời điểm liên kết user vào máy |
| `created_at` | timestamptz | NOT NULL | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL | Thời điểm cập nhật |

### 4.4 Bảng `user_sessions`
| Cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `id` | uuid | PK | Định danh session |
| `user_id` | uuid | FK -> `users.id`, NOT NULL | Chủ sở hữu session |
| `device_id` | uuid | FK -> `devices.id`, NOT NULL | Thiết bị tạo session |
| `token_hash` | text | UNIQUE, NOT NULL | SHA-256 của session token (raw token đặt trong cookie `session_id`) |
| `is_revoked` | boolean | NOT NULL, default `false` | Cờ revoke session |
| `revoked_at` | timestamptz | NULL | Thời điểm revoke |
| `revoke_reason` | varchar(100) | NULL | Lý do revoke (`logout`, `revoked_remote`) |
| `last_used_at` | timestamptz | NULL | Lần dùng gần nhất (cập nhật khi sliding renew) |
| `expires_at` | timestamptz | NOT NULL | Hết hạn session (now + TTL 7 ngày) |
| `created_at` | timestamptz | NOT NULL | Thời điểm tạo |
| `updated_at` | timestamptz | NOT NULL | Thời điểm cập nhật |

> Mô hình phiên dùng **một token cookie duy nhất** (`session_id`), không tách access/refresh và không dùng JWT. Token được rotate khi login lại/switch account, và gia hạn `expires_at` theo cơ chế sliding renew (chỉ ghi DB khi thời gian còn lại dưới 1 ngày).

## 5. Chỉ mục và ràng buộc quan trọng
- `users.email`: unique index.
- `users(provider, provider_user_id)`: unique index.
- `device_users(device_id, user_id)`: unique index.
- `user_sessions.token_hash`: unique index (tra cứu session theo hash token cookie).
- `user_sessions(user_id, is_revoked)`: index cho tra cứu session theo user.
- `user_sessions(device_id, is_revoked)`: index cho tra cứu session theo thiết bị.

> `previewFeatures = ["partialIndexes"]` đã bật trong generator Prisma; hiện chưa khai báo partial index nào trong schema.

## 6. Quy tắc dữ liệu cho các case hiện tại
- Một `user` tương ứng đúng một account Google (định danh bởi `provider_user_id`).
- Một thiết bị có thể liên kết nhiều user thông qua `device_users` (multi-account); khi link, account được set `is_active = true` và không tự deactivate account khác.
- Account đang "active" trên trình duyệt được xác định bởi cookie `session_id` hiện tại, không bởi cột `is_active`.
- Một user có thể đăng nhập trên nhiều thiết bị, mỗi thiết bị có session riêng trong `user_sessions`.
- Session được coi là "sống" khi `is_revoked = false` và `expires_at > now`. Đăng xuất/thu hồi từ xa set `is_revoked = true` kèm `revoke_reason`.
- Truy vấn nghiệp vụ mặc định loại bỏ bản ghi `users.is_deleted = true`.

## 7. Dữ liệu chưa nằm trong scope hiện tại
- Chưa thiết kế bảng cho split bill, quỹ chung, hoặc thống kê truy cập/metrics hệ thống ở phiên bản này.
