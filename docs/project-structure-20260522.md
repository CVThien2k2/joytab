# Cấu trúc dự án

## 1. Mục tiêu tài liệu
- Chuẩn hóa cách tổ chức thư mục theo nhiều tầng.
- Giúp tra cứu nhanh từ tầng dự án -> module -> file.

## 2. Tầng 1: Cây thư mục tổng dự án
```text
project-root/
├─ api/               # Service API (NestJS, monolith)
├─ ui/                # Frontend (Next.js App Router)
├─ docs/              # Tài liệu dự án (render bằng Zensical)
├─ .ai/               # Rule/skill cho agent
├─ .github/
├─ docker-compose.yml # PostgreSQL + Redis cho môi trường local
├─ AGENTS.md
└─ zensical.toml      # Cấu hình site tài liệu
```

Thành phần hạ tầng ngoài source code:
- PostgreSQL: database chính của hệ thống (image `postgres:16-alpine` trong `docker-compose.yml`).
- Redis: cache layer dùng cùng Service API (image `redis:7-alpine`).

## 3. Tầng 2: Cây thư mục chi tiết theo module

### 3.1 Backend `api/`
```text
api/
├─ .env.example
├─ .prettierrc
├─ eslint.config.mjs
├─ jest.config.js
├─ nest-cli.json
├─ package.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ prisma/
│  └─ schema.prisma
├─ prisma.config.ts
├─ src/
│  ├─ main.ts
│  ├─ app.module.ts
│  ├─ auth/
│  │  ├─ auth.constants.ts
│  │  ├─ auth.controller.ts
│  │  ├─ auth.module.ts
│  │  ├─ auth.service.ts
│  │  ├─ auth.utils.ts
│  │  ├─ device.service.ts
│  │  ├─ session.service.ts
│  │  ├─ token.service.ts
│  │  └─ dto/
│  │     └─ switch-account.dto.ts
│  ├─ cache/
│  │  └─ redis-cache.module.ts
│  ├─ common/
│  │  ├─ constants/
│  │  │  └─ error-codes.constant.ts
│  │  ├─ exceptions/
│  │  │  ├─ app.exception.ts
│  │  │  └─ http-exception.filter.ts
│  │  ├─ guards/
│  │  │  ├─ google-auth.guard.ts
│  │  │  └─ session.guard.ts
│  │  ├─ interceptors/
│  │  │  └─ response.interceptor.ts
│  │  ├─ interfaces/
│  │  │  └─ express-user.d.ts
│  │  ├─ loggers/
│  │  │  └─ app.logger.ts
│  │  ├─ middleware/
│  │  │  └─ request-logger.middleware.ts
│  │  ├─ pipes/
│  │  │  └─ parse-uuid.pipe.ts
│  │  ├─ strategies/
│  │  │  └─ google.strategy.ts
│  │  └─ utils/
│  │     ├─ database-url.ts
│  │     ├─ functions.ts
│  │     └─ types.ts
│  ├─ database/
│  │  ├─ database.module.ts
│  │  └─ database.service.ts
│  ├─ users/
│  │  ├─ users.controller.ts
│  │  └─ users.module.ts
│  └─ generated/
│     └─ prisma/            # Prisma Client sinh tự động bởi `pnpm db:generate` (không sửa tay)
├─ tsconfig.build.json
└─ tsconfig.json
```

Bảng mô tả chi tiết Backend:

| Đường dẫn | Loại | Vai trò |
|---|---|---|
| `api/.env.example` | Cấu hình | Mẫu biến môi trường, chú thích rõ biến bắt buộc/tùy chọn. |
| `api/.prettierrc` | Cấu hình | Thiết lập format code cho backend. |
| `api/eslint.config.mjs` | Cấu hình | Thiết lập luật lint cho backend. |
| `api/jest.config.js` | Cấu hình test | Cấu hình Jest cho unit/integration test. |
| `api/nest-cli.json` | Cấu hình | Cấu hình Nest CLI cho build/generate. |
| `api/package.json` | Metadata/Script | Khai báo script và dependency backend, gồm nhóm lệnh database với tiền tố `db:` (`db:generate`, `db:validate`, `db:migrate:*`, `db:push`, `db:pull`, `db:studio`, `db:format`). |
| `api/pnpm-lock.yaml` | Lockfile | Khóa phiên bản dependency backend. |
| `api/pnpm-workspace.yaml` | Cấu hình workspace | Cấu hình workspace pnpm cho module API. |
| `api/prisma/schema.prisma` | Cấu hình database | Định nghĩa schema Prisma cho PostgreSQL; generator xuất client ra `src/generated/prisma`. |
| `api/prisma.config.ts` | Cấu hình database | Cấu hình Prisma CLI và dựng datasource URL từ biến môi trường (`DB_*`). |
| `api/src/main.ts` | Mã nguồn | Entry point NestJS: bật `helmet` (tắt CSP), CORS theo `FRONTEND_ORIGIN` với `credentials: true`, `ValidationPipe` global (`transform`, `whitelist`), interceptor/filter global, shutdown hooks, listen `PORT` (default 3000). |
| `api/src/app.module.ts` | Mã nguồn | Module gốc: `ConfigModule` global validate `REQUIRED_ENV_KEYS` (fail-fast khi thiếu), `ThrottlerModule` global (60 req/60s), import các module nghiệp vụ, đăng ký `RequestLoggerMiddleware` cho mọi route. |
| `api/src/auth/auth.constants.ts` | Mã nguồn | Nguồn sự thật cho hằng số auth: TTL session (7 ngày), ngưỡng sliding renew (1 ngày), độ dài token, tên/ttl cookie `session_id`/`device_id`, rate-limit `/auth`. |
| `api/src/auth/auth.controller.ts` | Mã nguồn | Controller `/auth`: khởi tạo Google OAuth, callback set cookie `session_id`+`device_id` rồi redirect FE `/`, và các endpoint `switch`/`logout`/`accounts`/`me`/`devices`/`sessions/:id`. |
| `api/src/auth/auth.module.ts` | Mã nguồn | Module xác thực, gom controller/service/strategy/guard. |
| `api/src/auth/auth.service.ts` | Mã nguồn | Orchestrate nghiệp vụ: upsert user Google, ensure device, link device-user, tạo/refresh session, switch/logout, list account/device, revoke session. |
| `api/src/auth/auth.utils.ts` | Mã nguồn | Helper module auth: build URL redirect FE, đọc cookie từ header, validate UUID, parse platform/device name từ user-agent. |
| `api/src/auth/device.service.ts` | Mã nguồn | Quản lý `Device` + `DeviceUser`: ensure/tạo device theo cookie, link account (multi-account), liệt kê account theo device. |
| `api/src/auth/session.service.ts` | Mã nguồn | Vòng đời `UserSession`: tạo/refresh session, validate token (sliding renew), switch, revoke (logout/remote), liệt kê session sống. |
| `api/src/auth/token.service.ts` | Mã nguồn | Sinh session token ngẫu nhiên 32 byte (hex) và băm SHA-256; cung cấp TTL/ngưỡng renew. |
| `api/src/auth/dto/switch-account.dto.ts` | Mã nguồn | DTO validate body `POST /auth/switch` (`userId` là UUID). |
| `api/src/cache/redis-cache.module.ts` | Mã nguồn | Module cấu hình Redis cache, đọc env bắt buộc `REDIS_*` qua ConfigService và đăng ký CacheModule global. |
| `api/src/common/constants/error-codes.constant.ts` | Mã nguồn | Danh sách mã lỗi chuẩn dùng chung toàn backend. |
| `api/src/common/exceptions/app.exception.ts` | Mã nguồn | Exception nghiệp vụ dùng object mã lỗi chuẩn và map HTTP status tương ứng. |
| `api/src/common/exceptions/http-exception.filter.ts` | Mã nguồn | Global filter map exception về format lỗi chuẩn của dự án. |
| `api/src/common/guards/google-auth.guard.ts` | Mã nguồn | Guard bọc `AuthGuard('google')` để kích hoạt luồng OAuth Google. |
| `api/src/common/guards/session.guard.ts` | Mã nguồn | Guard xác thực cookie `session_id`+`device_id`, gán `req.userId/req.userEmail`; ném `AUTH_001/004/005` khi không hợp lệ. |
| `api/src/common/interceptors/response.interceptor.ts` | Mã nguồn | Global interceptor chuẩn hóa success response. |
| `api/src/common/interfaces/express-user.d.ts` | Khai báo kiểu | Mở rộng type `Express.User` dùng chung cho `req.user`. |
| `api/src/common/loggers/app.logger.ts` | Mã nguồn | Custom logger dùng queue bất đồng bộ; in terminal và ghi thêm vào `api/logs/YYYY-MM-DD.log`. |
| `api/src/common/middleware/request-logger.middleware.ts` | Mã nguồn | Middleware log request HTTP cho mọi route. |
| `api/src/common/pipes/parse-uuid.pipe.ts` | Mã nguồn | Pipe UUID dùng chung với format lỗi thống nhất. |
| `api/src/common/strategies/google.strategy.ts` | Mã nguồn | Passport strategy Google OAuth 2.0; callback URL dựng từ `${API_URL}/auth/google/callback`, scope `email profile`. |
| `api/src/common/utils/database-url.ts` | Mã nguồn | Helper dựng PostgreSQL connection string từ `DB_*`. |
| `api/src/common/utils/functions.ts` | Mã nguồn | Hàm dùng chung: đọc config bắt buộc, xác định runtime production theo `NODE_ENV`. |
| `api/src/common/utils/types.ts` | Mã nguồn | Type dùng chung: error code, response envelope, Google user profile. |
| `api/src/database/database.module.ts` | Mã nguồn | Module đóng gói và export service kết nối database. |
| `api/src/database/database.service.ts` | Mã nguồn | Service Prisma (adapter `pg`) dùng chung, kết nối có retry để các module inject. |
| `api/src/users/users.controller.ts` | Mã nguồn | `[DEMO]` endpoint nghiệp vụ `GET /users` (SessionGuard) để minh hoạ luồng popup hết phiên phía FE. |
| `api/src/users/users.module.ts` | Mã nguồn | Module đăng ký `UsersController`. |
| `api/src/generated/prisma/` | Sinh tự động | Prisma Client được sinh bởi `pnpm db:generate`; không sửa tay. |
| `api/tsconfig.json` | Cấu hình | Cấu hình TypeScript chính của backend. |
| `api/tsconfig.build.json` | Cấu hình build | Cấu hình TypeScript cho quá trình build. |

### 3.2 Frontend `ui/`
```text
ui/
├─ components.json          # Cấu hình shadcn/ui
├─ .env.example
├─ eslint.config.mjs
├─ next.config.ts
├─ next-env.d.ts
├─ package.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ postcss.config.mjs
├─ public/
├─ src/
│  ├─ api/
│  │  ├─ auth.ts             # Hàm gọi các endpoint /auth/*
│  │  ├─ client.ts           # Axios instance (withCredentials, xử lý 401)
│  │  └─ users.ts            # Hàm gọi endpoint nghiệp vụ demo /users
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ globals.css
│  │  ├─ favicon.ico
│  │  ├─ joytab-icon.svg
│  │  ├─ (auth)/
│  │  │  ├─ layout.tsx
│  │  │  ├─ _components/
│  │  │  │  └─ auth-header.tsx
│  │  │  └─ login/
│  │  │     └─ page.tsx
│  │  └─ (private)/
│  │     ├─ layout.tsx
│  │     ├─ page.tsx
│  │     ├─ _components/
│  │     │  └─ current-user-card.tsx
│  │     └─ users/
│  │        └─ page.tsx
│  ├─ components/
│  │  ├─ ui/                 # shadcn/ui: avatar, button, card, dialog, field, input, item, label, select, separator, sonner
│  │  ├─ common/             # color-theme-select, joytab-logo, loading-screen, logout-button, session-revoked-dialog, theme-mode-button
│  │  └─ wrapper/            # app-wrapper, require-auth, require-guest
│  ├─ css/                   # base.css + 17 file theme màu (amber, blue, ...)
│  ├─ hooks/
│  │  └─ use-auth-api.ts
│  ├─ lib/
│  │  ├─ google-login.ts
│  │  └─ utils.ts
│  ├─ providers/
│  │  ├─ active-theme.tsx
│  │  ├─ query-provider.tsx
│  │  └─ theme-provider.tsx
│  ├─ schema/
│  │  ├─ auth.ts             # Zod schema cho response auth
│  │  └─ envelope.ts         # Zod schema cho envelope success/error
│  ├─ stores/
│  │  └─ auth-store.ts       # Zustand store in-memory (user, checked, revoked)
│  └─ types/
│     └─ auth.ts
└─ tsconfig.json
```

Bảng mô tả chi tiết Frontend:

| Đường dẫn | Loại | Vai trò |
|---|---|---|
| `ui/components.json` | Cấu hình | Cấu hình shadcn/ui (style, alias, đường dẫn component). |
| `ui/.env.example` | Cấu hình | Mẫu biến môi trường FE; `NEXT_PUBLIC_API_BASE_URL` gồm prefix `/api/v1`. |
| `ui/next.config.ts` | Cấu hình | Cấu hình runtime/build cho Next.js. |
| `ui/postcss.config.mjs` | Cấu hình CSS pipeline | Cấu hình PostCSS và Tailwind. |
| `ui/src/api/client.ts` | Mã nguồn | Axios instance dùng chung: `withCredentials` để gửi cookie session; interceptor 401 (`AUTH_004` → popup hết phiên, còn lại → `/login`), riêng `/auth/*` để caller tự xử lý. |
| `ui/src/api/auth.ts` | Mã nguồn | Hàm gọi các endpoint `/auth/*` (me, accounts, switch, logout, devices, revoke session) + validate response bằng Zod. |
| `ui/src/api/users.ts` | Mã nguồn | Hàm gọi endpoint nghiệp vụ demo `GET /users`. |
| `ui/src/app/layout.tsx` | Mã nguồn | Root layout: nạp provider theme/query, wrapper toàn app. |
| `ui/src/app/(auth)/layout.tsx` | Mã nguồn | Layout vùng auth (guest-only), redirect về `/` nếu đã có session. |
| `ui/src/app/(auth)/_components/auth-header.tsx` | Mã nguồn | Header cho các trang auth. |
| `ui/src/app/(auth)/login/page.tsx` | Mã nguồn | Trang login: nút đăng nhập Google (redirect sang BE `/auth/google`). |
| `ui/src/app/(private)/layout.tsx` | Mã nguồn | Layout vùng private (require-auth) dựa trên trạng thái `/auth/me`. |
| `ui/src/app/(private)/page.tsx` | Mã nguồn | Trang chính `/`, hiển thị user hiện tại và account switcher. |
| `ui/src/app/(private)/_components/current-user-card.tsx` | Mã nguồn | Card thông tin user hiện tại. |
| `ui/src/app/(private)/users/page.tsx` | Mã nguồn | Trang demo gọi `GET /users` để minh hoạ popup hết phiên. |
| `ui/src/components/ui/` | Mã nguồn | Bộ component shadcn/ui dùng chung. |
| `ui/src/components/common/` | Mã nguồn | Component nghiệp vụ dùng chung: chọn theme màu, logo, loading, logout, dialog phiên bị thu hồi, đổi light/dark. |
| `ui/src/components/wrapper/` | Mã nguồn | Wrapper điều phối auth: `app-wrapper` (validate `/auth/me`), `require-auth`, `require-guest`. |
| `ui/src/css/` | Mã nguồn CSS | `base.css` + các file theme màu cho tính năng đổi màu chủ đề. |
| `ui/src/hooks/use-auth-api.ts` | Mã nguồn | Hook React Query cho các thao tác auth (useMe, switch, logout, ...). |
| `ui/src/lib/google-login.ts` | Mã nguồn | Redirect browser sang BE `/auth/google` (tuỳ chọn `prompt=select_account` cho luồng thêm account). |
| `ui/src/lib/utils.ts` | Mã nguồn | Helper dùng chung FE (cn/classnames, ...). |
| `ui/src/providers/query-provider.tsx` | Mã nguồn | QueryClientProvider toàn app cho React Query. |
| `ui/src/providers/theme-provider.tsx` | Mã nguồn | Provider light/dark dùng `next-themes`. |
| `ui/src/providers/active-theme.tsx` | Mã nguồn | Provider chọn theme màu đang active. |
| `ui/src/schema/auth.ts` | Mã nguồn | Zod schema validate response các endpoint auth. |
| `ui/src/schema/envelope.ts` | Mã nguồn | Zod schema cho envelope response chuẩn (`success/message/data`). |
| `ui/src/stores/auth-store.ts` | Mã nguồn | Zustand store in-memory (không persist): `user`, `checked` (đã validate `/auth/me`), `revoked` (popup phiên bị thu hồi). |
| `ui/src/types/auth.ts` | Mã nguồn | Type FE cho user/auth (suy ra từ Zod schema). |
| `ui/tsconfig.json` | Cấu hình | Cấu hình TypeScript chính của frontend. |

### 3.3 Tài liệu `docs/`
```text
docs/
├─ index.md
├─ business-overview-and-system-requirements-20260522.md
├─ system-architecture-20260522.md
├─ project-structure-20260522.md
├─ thiet-ke-he-thong-20260522.md
├─ database-design-20260522.md
├─ technology-selection-20260522.md
├─ general-conventions-20260522.md
├─ security-20260522.md
├─ environment-configuration-reference-20260522.md
├─ project-error-codes-20260522.md
└─ phien-ban-20260522.md
```

> Khi thêm/xóa file docs, cập nhật đồng thời `docs/index.md` và `nav` trong `zensical.toml`.
