# Tra cứu cấu hình môi trường

## 1. Mục tiêu tài liệu
- Tra cứu nhanh biến môi trường theo từng module.
- Nguồn đối chiếu: `api/.env.example`, `ui/.env.example`, `app.module.ts` (`REQUIRED_ENV_KEYS`).

## 2. Danh sách môi trường
- Local
- Development
- Staging
- Production

## 3. Bảng biến môi trường
`Bắt buộc = Y` nghĩa là biến nằm trong `REQUIRED_ENV_KEYS` — thiếu là app ném lỗi ngay lúc bootstrap.

| Biến | Module | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|---|
| `PORT` | api | N | `3000` | Cổng chạy Service API (`main.ts`). |
| `NODE_ENV` | api | N | `development` | Môi trường backend; `production` => cookie `Secure`. |
| `DB_HOST` | api | Y | - | Host PostgreSQL. |
| `DB_PORT` | api | N | `5432` | Port PostgreSQL (`prisma.config.ts`). |
| `DB_USER` | api | Y | - | Username PostgreSQL. |
| `DB_PASSWORD` | api | Y | - | Password PostgreSQL. |
| `DB_NAME` | api | Y | - | Tên database PostgreSQL. |
| `DB_PARAMS` | api | N | - | Query params nối vào connection string (vd `sslmode=require`). |
| `REDIS_HOST` | api | Y | - | Host Redis. |
| `REDIS_PORT` | api | Y | - | Port Redis. |
| `REDIS_PASSWORD` | api | N | - | Mật khẩu Redis; chỉ set khi Redis bật auth. |
| `REDIS_DB` | api | Y | - | Chỉ số database Redis. |
| `GOOGLE_CLIENT_ID` | api | Y | - | Client ID OAuth 2.0 cho đăng nhập Google. |
| `GOOGLE_CLIENT_SECRET` | api | Y | - | Client secret OAuth 2.0. |
| `API_URL` | api | Y | `http://localhost:8000` | Base URL API; dùng dựng callback Google `${API_URL}/auth/google/callback` (`google.strategy.ts`). |
| `FRONTEND_ORIGIN` | api | N | `http://localhost:3000` | Origin FE để BE redirect sau login và cấu hình CORS `credentials: true`. |
| `COOKIE_DOMAIN` | api | N | - | Domain cookie first-party chia sẻ FE + API subdomain (vd `.joytab.com`); để trống ở local. |
| `JWT_SECRET` | api | N | - | **Chưa dùng** trong code (design intent). Mô hình phiên hiện tại không dùng JWT. |
| `NEXT_PUBLIC_API_BASE_URL` | ui | N | `http://localhost:8000/api/v1` | Base URL API cho FE (gồm prefix `/api/v1` của gateway edge). |

## 4. Nhóm cấu hình theo chức năng
### 4.1 Ứng dụng
- `PORT`, `NODE_ENV`

### 4.2 Database (PostgreSQL)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PARAMS`

### 4.3 Cache (Redis)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`

### 4.4 Xác thực & bảo mật
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `API_URL`, `COOKIE_DOMAIN`

### 4.5 Tích hợp FE-BE
- `FRONTEND_ORIGIN` (BE), `NEXT_PUBLIC_API_BASE_URL` (FE).
- FE gọi API với `withCredentials: true` để kèm cookie `session_id`/`device_id`.
- `NEXT_PUBLIC_API_BASE_URL` gồm prefix `/api/v1`: gateway `:8000` nhận `/api` → strip → forward tới core service; core NestJS phục vụ trực tiếp các path `/auth/*`, `/users/*`.

## 5. Quy trình cập nhật cấu hình
1. Cập nhật `api/.env.example` hoặc `ui/.env.example` khi thêm/bớt biến.
2. Nếu biến là bắt buộc phía BE, cập nhật `REQUIRED_ENV_KEYS` trong `app.module.ts`.
3. Cập nhật bảng biến ở tài liệu này.

## 6. Lưu ý an toàn
- Không commit secret vào Git; chỉ commit `.env.example`.
- API dừng ngay khi bootstrap nếu thiếu biến bắt buộc (xem cột `Bắt buộc = Y`).
