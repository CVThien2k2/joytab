# Mã lỗi dự án

## 1. Mục tiêu tài liệu
- Chuẩn hóa hệ thống mã lỗi cho toàn dự án.

## 2. Quy ước đặt mã lỗi
- Format đề xuất: `<DOMAIN>_<NNN>`
- Ví dụ: `AUTH_001`, `USER_002`, `SYS_001`

## 3. Danh sách mã lỗi
| Mã lỗi | HTTP Status | Thông điệp chuẩn | Ý nghĩa | Hướng xử lý |
|---|---|---|---|---|
| `AUTH_001` | `401` | Unauthorized | Lỗi xác thực: thiếu/không hợp lệ session cookie, session không khớp device, account cần đăng nhập lại. | Kiểm tra cookie `session_id`/`device_id` và trạng thái đăng nhập. |
| `AUTH_002` | `400` | Google profile invalid | Profile callback từ Google thiếu thông tin bắt buộc (email). | Kiểm tra scope OAuth và profile Google trả về. |
| `AUTH_003` | `401` | Google login code invalid or expired | (Legacy) mã one-time exchange — không còn được throw trong luồng session cookie hiện tại; giữ lại để tương thích. | Không áp dụng cho luồng hiện tại. |
| `AUTH_004` | `401` | Session revoked | Session đã bị thu hồi (logout hoặc revoke từ xa). | Đăng nhập lại; FE bật popup phiên bị thu hồi. |
| `AUTH_005` | `401` | Session expired | Session đã hết hạn (`expires_at <= now`). | Đăng nhập lại để tạo phiên mới. |
| `VALIDATION_001` | `400` | Bad request | Dữ liệu đầu vào không hợp lệ theo rule validate/pipes. | Kiểm tra payload/query/path params trước khi gọi API. |
| `SYS_404` | `404` | Resource not found | Không tìm thấy endpoint hoặc tài nguyên tương ứng. | Kiểm tra URL, method HTTP và ID resource. |
| `SYS_001` | `500` | Internal server error | Lỗi hệ thống nội bộ không mong muốn. | Kiểm tra log backend, cấu hình và trạng thái hạ tầng. |
| `SYS_002` | `500` | Missing GOOGLE_CLIENT_ID | Thiếu `GOOGLE_CLIENT_ID` khi khởi tạo Google OAuth strategy. | Bổ sung `GOOGLE_CLIENT_ID` trong env runtime của API. |
| `SYS_003` | `500` | Missing GOOGLE_CLIENT_SECRET | Thiếu `GOOGLE_CLIENT_SECRET` khi khởi tạo Google OAuth strategy. | Bổ sung `GOOGLE_CLIENT_SECRET` trong env runtime của API. |
| `SYS_004` | `500` | Missing API_URL | Thiếu `API_URL` khi dựng callback URL Google. | Bổ sung `API_URL` trong env runtime của API. |
| `SYS_005` | `500` | Missing DB_HOST | Thiếu `DB_HOST` khi khởi tạo DatabaseService. | Bổ sung `DB_HOST` trong env runtime của API. |
| `SYS_006` | `500` | Missing DB_USER | Thiếu `DB_USER` khi khởi tạo DatabaseService. | Bổ sung `DB_USER` trong env runtime của API. |
| `SYS_007` | `500` | Missing DB_PASSWORD | Thiếu `DB_PASSWORD` khi khởi tạo DatabaseService. | Bổ sung `DB_PASSWORD` trong env runtime của API. |
| `SYS_008` | `500` | Missing DB_NAME | Thiếu `DB_NAME` khi khởi tạo DatabaseService. | Bổ sung `DB_NAME` trong env runtime của API. |
| `SYS_009` | `500` | Missing REDIS_HOST | Thiếu `REDIS_HOST` khi khởi tạo Redis cache module. | Bổ sung `REDIS_HOST` trong env runtime của API. |
| `SYS_010` | `500` | Missing REDIS_PORT | Thiếu `REDIS_PORT` khi khởi tạo Redis cache module. | Bổ sung `REDIS_PORT` trong env runtime của API. |
| `SYS_011` | `500` | Missing REDIS_PASSWORD | Thiếu `REDIS_PASSWORD` khi khởi tạo Redis cache module. | Bổ sung `REDIS_PASSWORD` trong env runtime của API. |
| `SYS_012` | `500` | Missing REDIS_DB | Thiếu `REDIS_DB` khi khởi tạo Redis cache module. | Bổ sung `REDIS_DB` trong env runtime của API. |
| `SYS_013` | `500` | Database connection failed | Không kết nối được PostgreSQL (sau retry) khi khởi tạo/chạy. | Kiểm tra `DB_*`, trạng thái PostgreSQL và network. |
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
