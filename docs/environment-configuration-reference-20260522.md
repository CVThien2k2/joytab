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
| `NODE_ENV` | api | N | `development` | Môi trường chạy backend; dùng để bật chính sách cookie callback Google (`production` => `SameSite=None; Secure`, còn lại => `SameSite=Lax; Secure=false`). |
| `DB_HOST` | api | Y | - | Host PostgreSQL server (bắt buộc, không fallback trong code). |
| `DB_USER` | api | Y | - | Username kết nối PostgreSQL (bắt buộc, không fallback trong code). |
| `DB_PASSWORD` | api | Y | - | Password kết nối PostgreSQL (bắt buộc, không fallback trong code). |
| `DB_NAME` | api | Y | - | Tên database PostgreSQL (bắt buộc, không fallback trong code). |
| `GOOGLE_CLIENT_ID` | api | Y | - | Client ID OAuth 2.0 cho đăng nhập Google. |
| `GOOGLE_CLIENT_SECRET` | api | Y | - | Client secret OAuth 2.0 cho đăng nhập Google. |
| `GOOGLE_CALLBACK_URL` | api | Y | `http://localhost:3000/auth/google/callback` | Callback URL nhận redirect từ Google OAuth. |
| `GOOGLE_CALLBACK_JWT_SECRET` | api | Y | - | Secret ký JWT `google_change_token` cho bước exchange callback Google (hết hạn 60 giây). |
| `ACCESS_TOKEN_JWT_SECRET` | api | Y | - | Secret ký access token trả về ở `POST /auth/google/exchange`. |
| `REFRESH_TOKEN_JWT_SECRET` | api | Y | - | Secret ký refresh token lưu trong cookie HttpOnly `refresh_token`. |
| `FRONTEND_ORIGIN` | api | N | `http://localhost:3000` | Origin FE để BE redirect cố định và cấu hình CORS `credentials: true` cho Google OAuth. |
| `NEXT_PUBLIC_API_BASE_URL` | ui | N | `http://localhost:8000` | Base URL API để FE gọi endpoint `/auth/google` và `/auth/google/exchange`. |
| `REDIS_HOST` | api | Y | - | Host Redis server (bắt buộc, không fallback trong code). |
| `REDIS_PORT` | api | Y | - | Port Redis server (bắt buộc, không fallback trong code). |
| `REDIS_PASSWORD` | api | Y | - | Mật khẩu Redis (bắt buộc, không fallback trong code). |
| `REDIS_DB` | api | Y | - | Chỉ số database Redis (bắt buộc, không fallback trong code). |

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
- `GOOGLE_CALLBACK_JWT_SECRET`
- `ACCESS_TOKEN_JWT_SECRET`
- `REFRESH_TOKEN_JWT_SECRET`

### 4.5 Tích hợp FE-BE đăng nhập Google
- `FRONTEND_ORIGIN`
- `NEXT_PUBLIC_API_BASE_URL`
- FE gọi `POST /auth/google/exchange` phải bật gửi credentials để kèm cookie `google_change_token`.
- BE trả access token trong JSON response và set refresh token vào cookie HttpOnly `refresh_token`.

## 5. Quy trình cập nhật cấu hình
1. <Bước 1>
2. <Bước 2>
3. <Bước 3>

## 6. Lưu ý an toàn
- Không commit secret vào Git.
- Dùng file `.env.example` để mô tả biến bắt buộc.
- API sẽ dừng ngay ở lúc khởi động nếu thiếu các biến bắt buộc (`DB_*`, `REDIS_*`, `GOOGLE_*`, `ACCESS_TOKEN_JWT_SECRET`, `REFRESH_TOKEN_JWT_SECRET` theo bảng trên).
