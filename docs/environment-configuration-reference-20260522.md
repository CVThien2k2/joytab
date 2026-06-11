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
| `SSO_URL` | api-gateway | Y | `http://localhost:8001` | URL nội bộ của SSO để gateway proxy `/auth/*` và `/api/*`. |
| `REDIS_HOST` | api-gateway | Y | - | Host Redis server để validate session (trùng cấu hình SSO). |
| `REDIS_PORT` | api-gateway | Y | - | Port Redis server. |
| `REDIS_PASSWORD` | api-gateway | Y | - | Mật khẩu Redis. |
| `REDIS_DB` | api-gateway | Y | - | Chỉ số database Redis. |
| `CORS_ALLOWED_ORIGINS` | api-gateway | Y | `http://localhost:3000` | Allowlist origin cho CORS + kiểm tra CSRF Origin/Referer (phân tách dấu phẩy; hỗ trợ `https://*.example.com`). |
| `COOKIE_DOMAIN` | api-gateway | N | - | Cookie domain dùng chung cross-subdomain; rỗng = host-only cho local dev. |
| `NODE_ENV` | api-gateway | N | `development` | Môi trường chạy gateway. |

### 3.2 SSO (`sso`)
| Biến | Module | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|---|
| `PORT` | sso | Y | `8001` | Cổng nội bộ của SSO; chỉ gateway proxy tới (không public). |
| `NODE_ENV` | sso | N | `development` | Môi trường chạy backend; dùng để bật chính sách cookie callback Google (`production` => `SameSite=None; Secure`, còn lại => `SameSite=Lax; Secure=false`). |
| `DB_HOST` | sso | Y | - | Host PostgreSQL server (bắt buộc, không fallback trong code). |
| `DB_USER` | sso | Y | - | Username kết nối PostgreSQL (bắt buộc, không fallback trong code). |
| `DB_PASSWORD` | sso | Y | - | Password kết nối PostgreSQL (bắt buộc, không fallback trong code). |
| `DB_NAME` | sso | Y | - | Tên database PostgreSQL (bắt buộc, không fallback trong code). |
| `GOOGLE_CLIENT_ID` | sso | Y | - | Client ID OAuth 2.0 cho đăng nhập Google. |
| `GOOGLE_CLIENT_SECRET` | sso | Y | - | Client secret OAuth 2.0 cho đăng nhập Google. |
| `API_URL` | sso | Y | `http://localhost:8000` | URL public của hệ thống (gateway); SSO build `redirect_uri` Google OAuth là `${API_URL}/auth/google/callback` nên callback trỏ về gateway. |
| `JWT_SECRET` | sso | Y | - | Secret HS256 ký access token trả về ở `POST /auth/google/exchange`. Google change token và refresh token sinh ngẫu nhiên + SHA-256 hash lưu Redis (không dùng JWT). |
| `FRONTEND_ORIGIN` | sso | N | `http://localhost:3000` | Origin FE để BE redirect cố định sau callback Google. CORS/CSRF nay do gateway xử lý. |
| `REDIS_HOST` | sso | Y | - | Host Redis server (bắt buộc, không fallback trong code). |
| `REDIS_PORT` | sso | Y | - | Port Redis server (bắt buộc, không fallback trong code). |
| `REDIS_PASSWORD` | sso | Y | - | Mật khẩu Redis (bắt buộc, không fallback trong code). |
| `REDIS_DB` | sso | Y | - | Chỉ số database Redis (bắt buộc, không fallback trong code). |

### 3.3 Frontend (`ui`)
| Biến | Module | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | ui | N | `http://localhost:8000` | Base URL để FE gọi vào API Gateway (`/auth/google`, `/auth/google/exchange`, ...). |

## 4. Nhóm cấu hình theo chức năng
### 4.1 Ứng dụng
- `PORT` (gateway `8000`, sso `8001`)
- `SSO_URL` (gateway proxy tới SSO)
- `NODE_ENV`

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
- `CORS_ALLOWED_ORIGINS` (gateway sở hữu CORS + CSRF; SSO không tự bật nữa)
- `COOKIE_DOMAIN`

### 4.5 Tích hợp FE-BE đăng nhập Google
- `FRONTEND_ORIGIN` (SSO redirect sau login)
- `API_URL` (gateway, driver cho `redirect_uri` Google OAuth)
- `NEXT_PUBLIC_API_BASE_URL` (FE trỏ vào gateway `8000`)
- FE luôn gọi qua API Gateway (`8000`); gateway proxy sang SSO (`8001`).
- FE gọi `POST /auth/google/exchange` phải bật gửi credentials để kèm cookie `google_change_token`.
- BE trả access token trong JSON response để FE persist theo account; phiên được set vào cookie HttpOnly `session_id` mà gateway dùng để validate qua Redis.

## 5. Quy trình cập nhật cấu hình
1. <Bước 1>
2. <Bước 2>
3. <Bước 3>

## 6. Lưu ý an toàn
- Không commit secret vào Git.
- Dùng file `.env.example` để mô tả biến bắt buộc.
- SSO sẽ dừng ngay ở lúc khởi động nếu thiếu các biến bắt buộc (`DB_*`, `REDIS_*`, `GOOGLE_*`, `API_URL`, `JWT_SECRET` theo bảng trên).
- Gateway cần `SSO_URL`, `REDIS_*` và `CORS_ALLOWED_ORIGINS` để xác thực edge và proxy đúng.
