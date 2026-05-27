# Mã lỗi dự án

## 1. Mục tiêu tài liệu
- Chuẩn hóa hệ thống mã lỗi cho toàn dự án.

## 2. Quy ước đặt mã lỗi
- Format đề xuất: `<DOMAIN>_<NNN>`
- Ví dụ: `AUTH_001`, `USER_002`, `SYS_001`

## 3. Danh sách mã lỗi
| Mã lỗi | HTTP Status | Thông điệp chuẩn | Ý nghĩa | Hướng xử lý |
|---|---|---|---|---|
| `AUTH_001` | `401` | Unauthorized | Lỗi xác thực hoặc không có quyền truy cập resource bảo vệ. | Kiểm tra token/session và trạng thái đăng nhập. |
| `AUTH_002` | `400` | Google profile invalid | Dữ liệu callback từ Google thiếu thông tin bắt buộc (ví dụ email). | Kiểm tra scope OAuth và profile Google trả về. |
| `AUTH_003` | `401` | Google login code invalid or expired | Mã code một lần dùng để đổi token đã hết hạn, không tồn tại hoặc không hợp lệ. | Đăng nhập Google lại để nhận mã callback mới. |
| `VALIDATION_001` | `400` | Bad request | Dữ liệu đầu vào không hợp lệ theo rule validate/pipes. | Kiểm tra payload/query/path params trước khi gọi API. |
| `SYS_404` | `404` | Resource not found | Không tìm thấy endpoint hoặc tài nguyên tương ứng. | Kiểm tra URL, method HTTP và ID resource. |
| `SYS_001` | `500` | Internal server error | Lỗi hệ thống nội bộ không mong muốn. | Kiểm tra log backend, cấu hình và trạng thái hạ tầng. |
| `SYS_002` | `500` | Missing GOOGLE_CLIENT_ID | Thiếu biến môi trường `GOOGLE_CLIENT_ID` khi khởi tạo Google OAuth strategy. | Bổ sung `GOOGLE_CLIENT_ID` trong env runtime của API. |
| `SYS_003` | `500` | Missing GOOGLE_CLIENT_SECRET | Thiếu biến môi trường `GOOGLE_CLIENT_SECRET` khi khởi tạo Google OAuth strategy. | Bổ sung `GOOGLE_CLIENT_SECRET` trong env runtime của API. |
| `SYS_004` | `500` | Missing GOOGLE_CALLBACK_URL | Thiếu biến môi trường `GOOGLE_CALLBACK_URL` khi khởi tạo Google OAuth strategy. | Bổ sung `GOOGLE_CALLBACK_URL` trong env runtime của API. |
| `SYS_005` | `500` | Missing DB_HOST | Thiếu biến môi trường `DB_HOST` khi khởi tạo DatabaseService. | Bổ sung `DB_HOST` trong env runtime của API. |
| `SYS_006` | `500` | Missing DB_USER | Thiếu biến môi trường `DB_USER` khi khởi tạo DatabaseService. | Bổ sung `DB_USER` trong env runtime của API. |
| `SYS_007` | `500` | Missing DB_PASSWORD | Thiếu biến môi trường `DB_PASSWORD` khi khởi tạo DatabaseService. | Bổ sung `DB_PASSWORD` trong env runtime của API. |
| `SYS_008` | `500` | Missing DB_NAME | Thiếu biến môi trường `DB_NAME` khi khởi tạo DatabaseService. | Bổ sung `DB_NAME` trong env runtime của API. |
| `SYS_009` | `500` | Missing REDIS_HOST | Thiếu biến môi trường `REDIS_HOST` khi khởi tạo Redis cache module. | Bổ sung `REDIS_HOST` trong env runtime của API. |
| `SYS_010` | `500` | Missing REDIS_PORT | Thiếu biến môi trường `REDIS_PORT` khi khởi tạo Redis cache module. | Bổ sung `REDIS_PORT` trong env runtime của API. |
| `SYS_011` | `500` | Missing REDIS_PASSWORD | Thiếu biến môi trường `REDIS_PASSWORD` khi khởi tạo Redis cache module. | Bổ sung `REDIS_PASSWORD` trong env runtime của API. |
| `SYS_012` | `500` | Missing REDIS_DB | Thiếu biến môi trường `REDIS_DB` khi khởi tạo Redis cache module. | Bổ sung `REDIS_DB` trong env runtime của API. |
| `SYS_014` | `500` | Missing JWT_SECRET | Thiếu biến môi trường `JWT_SECRET` khi ký access token. | Bổ sung `JWT_SECRET` trong env runtime của API. |
| `UNKNOWN_001` | `>=400` hoặc `500` | Unknown error | Exception không phải `AppException`, code chuẩn fallback cho hệ thống. | Kiểm tra message lỗi gốc và stack trace trong log để truy vết nguồn throw. |

## 4. Mapping exception -> mã lỗi
| Nguồn lỗi | Điều kiện | Mã lỗi |
|---|---|---|
| AppException | Throw qua `new AppException(ERROR_CODES.X)` | Theo `ERROR_CODES.X` |
| Exception khác | `BadRequestException`, `NotFoundException`, `Error`, ... | `UNKNOWN_001` |

## 5. Quy trình bổ sung mã lỗi mới
1. Kiểm tra trùng mã hiện có.
2. Bổ sung vào bảng mã lỗi.
3. Cập nhật logic mapping trong code.
4. Cập nhật tài liệu liên quan.
