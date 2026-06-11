# Tra cứu cấu hình môi trường

## 1. Mục tiêu tài liệu
- Tra cứu nhanh biến môi trường theo từng module và môi trường chạy.

## 2. Danh sách môi trường
- Local
- Development
- Staging
- Production

## 3. Bảng biến môi trường

### 3.1 API Gateway (`api-gateway`)
| Biến | Module | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|---|
| `PORT` | api-gateway | Y | `8000` | Cổng public duy nhất của hệ thống; FE gọi vào đây. |
| `CORE_URL` | api-gateway | Y | `http://localhost:8001` | URL nội bộ của core để gateway proxy `/api/*` sang (strip prefix `/api`, forward `/v1/...`). |
| `REDIS_HOST` | api-gateway | Y | - | Host Redis server để validate session (trùng cấu hình core). |
| `REDIS_PORT` | api-gateway | Y | - | Port Redis server. |
| `REDIS_PASSWORD` | api-gateway | Y | - | Mật khẩu Redis. |
| `REDIS_DB` | api-gateway | Y | - | Chỉ số database Redis. |
| `CORS_ALLOWED_ORIGINS` | api-gateway | Y | `http://localhost:3000` | Allowlist origin cho CORS + kiểm tra CSRF Origin/Referer (phân tách dấu phẩy; hỗ trợ `https://*.example.com`). |
| `COOKIE_DOMAIN` | api-gateway | N | - | Cookie domain dùng chung cross-subdomain; rỗng = host-only cho local dev. |
| `NODE_ENV` | api-gateway | N | `development` | Môi trường chạy gateway. |
| `LOG_LEVEL` | api-gateway | N | `info` | Mức log `nestjs-pino` (`trace|debug|info|warn|error|fatal`); log JSON ra stdout. |
| `PROXY_TIMEOUT_MS` | api-gateway | N | `30000` | Timeout (ms) khi gateway proxy request sang core; quá hạn trả `SYS_504` (504). |

### 3.2 Core (`core`)
| Biến | Module | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|---|
| `PORT` | core | Y | `8001` | Cổng nội bộ của core; chỉ gateway proxy tới (không public). |
| `NODE_ENV` | core | N | `development` | Môi trường chạy backend; dùng để bật chính sách cookie callback Google (`production` => `SameSite=None; Secure`, còn lại => `SameSite=Lax; Secure=false`). |
| `LOG_LEVEL` | core | N | `info` | Mức log `nestjs-pino` (`trace|debug|info|warn|error|fatal`); log JSON ra stdout. |
| `DB_HOST` | core | Y | - | Host PostgreSQL server (bắt buộc, không fallback trong code). |
| `DB_USER` | core | Y | - | Username kết nối PostgreSQL (bắt buộc, không fallback trong code). |
| `DB_PASSWORD` | core | Y | - | Password kết nối PostgreSQL (bắt buộc, không fallback trong code). |
| `DB_NAME` | core | Y | - | Tên database PostgreSQL (bắt buộc, không fallback trong code). |
| `GOOGLE_CLIENT_ID` | core | Y | - | Client ID OAuth 2.0 cho đăng nhập Google. |
| `GOOGLE_CLIENT_SECRET` | core | Y | - | Client secret OAuth 2.0 cho đăng nhập Google. |
| `API_URL` | core | Y | `http://localhost:8000` | URL public của hệ thống (gateway); core build `redirect_uri` Google OAuth là `${API_URL}/api/v1/auth/google/callback` nên callback trỏ về gateway. |
| `JWT_SECRET` | core | Y | - | Secret HS256 ký access token trả về ở `POST /api/v1/auth/google/exchange`. Google change token và refresh token sinh ngẫu nhiên + SHA-256 hash lưu Redis (không dùng JWT). |
| `FRONTEND_ORIGIN` | core | N | `http://localhost:3000` | Origin FE để BE redirect cố định sau callback Google. CORS/CSRF nay do gateway xử lý. |
| `REDIS_HOST` | core | Y | - | Host Redis server (bắt buộc, không fallback trong code). |
| `REDIS_PORT` | core | Y | - | Port Redis server (bắt buộc, không fallback trong code). |
| `REDIS_PASSWORD` | core | Y | - | Mật khẩu Redis (bắt buộc, không fallback trong code). |
| `REDIS_DB` | core | Y | - | Chỉ số database Redis (bắt buộc, không fallback trong code). |

### 3.3 Frontend (`ui`)
| Biến | Module | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | ui | N | `http://localhost:8000/api/v1` | Base URL để FE gọi vào API Gateway dưới namespace `/api/v1`; FE giữ path tương đối (`/auth/me`, `/users`, `/auth/google`, ...) và axios resolve thành `/api/v1/...`. |

## 4. Nhóm cấu hình theo chức năng
### 4.1 Ứng dụng
- `PORT` (gateway `8000`, core `8001`)
- `CORE_URL` (gateway proxy tới core)
- `NODE_ENV`
- `LOG_LEVEL` (gateway + core; mức log pino stdout, mặc định `info`)

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
- `JWT_SECRET`
- `CORS_ALLOWED_ORIGINS` (gateway sở hữu CORS + CSRF; core không tự bật nữa)
- `COOKIE_DOMAIN`

### 4.5 Tích hợp FE-BE đăng nhập Google
- `FRONTEND_ORIGIN` (Core redirect sau login)
- `API_URL` (gateway, driver cho `redirect_uri` Google OAuth)
- `NEXT_PUBLIC_API_BASE_URL` (FE trỏ vào gateway namespace `http://localhost:8000/api/v1`)
- FE luôn gọi qua API Gateway namespace `/api/v1`; gateway strip `/api` và proxy `/v1/...` sang core (`8001`).
- FE gọi `POST /api/v1/auth/google/exchange` phải bật gửi credentials để kèm cookie `google_change_token`.
- BE trả access token trong JSON response để FE persist theo account; phiên được set vào cookie HttpOnly `session_id` mà gateway dùng để validate qua Redis.

## 5. Quy trình cập nhật cấu hình
1. <Bước 1>
2. <Bước 2>
3. <Bước 3>

## 6. Lưu ý an toàn
- Không commit secret vào Git.
- Dùng file `.env.example` để mô tả biến bắt buộc.
- Core sẽ dừng ngay ở lúc khởi động nếu thiếu các biến bắt buộc (`DB_*`, `REDIS_*`, `GOOGLE_*`, `API_URL`, `JWT_SECRET` theo bảng trên).
- Gateway cần `CORE_URL`, `REDIS_*` và `CORS_ALLOWED_ORIGINS` để xác thực edge và proxy đúng.
