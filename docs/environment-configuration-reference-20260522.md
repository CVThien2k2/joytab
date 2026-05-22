# Tra cứu cấu hình môi trường

## 1. Mục tiêu tài liệu
- Tra cứu nhanh biến môi trường theo từng module và môi trường chạy.

## 2. Danh sách môi trường
- Local
- Development
- Staging
- Production

## 3. Bảng biến môi trường
| Biến | Module | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|---|
| `PORT` | api | Y | `3000` | Cổng chạy Service API. |
| `DB_HOST` | api | Y | - | Host PostgreSQL server (bắt buộc, không fallback trong code). |
| `DB_USER` | api | Y | - | Username kết nối PostgreSQL (bắt buộc, không fallback trong code). |
| `DB_PASSWORD` | api | Y | - | Password kết nối PostgreSQL (bắt buộc, không fallback trong code). |
| `DB_NAME` | api | Y | - | Tên database PostgreSQL (bắt buộc, không fallback trong code). |
| `GOOGLE_CLIENT_ID` | api | Y | - | Client ID OAuth 2.0 cho đăng nhập Google. |
| `GOOGLE_CLIENT_SECRET` | api | Y | - | Client secret OAuth 2.0 cho đăng nhập Google. |
| `GOOGLE_CALLBACK_URL` | api | Y | `http://localhost:3000/auth/google/callback` | Callback URL nhận redirect từ Google OAuth. |
| `REDIS_HOST` | api | Y | `127.0.0.1` | Host Redis server. |
| `REDIS_PORT` | api | Y | `6379` | Port Redis server. |
| `REDIS_PASSWORD` | api | N | - | Mật khẩu Redis nếu môi trường bật auth. |
| `REDIS_DB` | api | N | `0` | Chỉ số database trong Redis. |

## 4. Nhóm cấu hình theo chức năng
### 4.1 Ứng dụng
- <Danh sách biến>

### 4.2 Database
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

### 4.3 Cache/Queue
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `REDIS_DB`

### 4.4 Bảo mật
- `GOOGLE_CLIENT_SECRET`

## 5. Quy trình cập nhật cấu hình
1. <Bước 1>
2. <Bước 2>
3. <Bước 3>

## 6. Lưu ý an toàn
- Không commit secret vào Git.
- Dùng file `.env.example` để mô tả biến bắt buộc.
