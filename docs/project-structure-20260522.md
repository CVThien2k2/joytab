# Cấu trúc dự án

## 1. Mục tiêu tài liệu
- Chuẩn hóa cách tổ chức thư mục theo nhiều tầng.
- Giúp tra cứu nhanh từ tầng dự án -> module -> file.

## 2. Tầng 1: Cây thư mục tổng dự án
```text
project-root/
├─ api-gateway/
├─ sso/
├─ ui/
├─ docs/
├─ .ai/
├─ .github/
├─ docker-compose.yml
├─ AGENTS.md
└─ zensical.toml
```

Thành phần hạ tầng ngoài source code:
- PostgreSQL: database chính của hệ thống (nguồn sự thật cho phiên/thiết bị/audit).
- Redis: store validate session tốc độ cao cho gateway và cache layer dùng cùng SSO.

Vai trò hai service backend:
- `api-gateway/`: điểm vào public duy nhất (port `8000`), xử lý CORS/CSRF + xác thực edge bằng Redis rồi proxy sang SSO.
- `sso/`: service nội bộ (port `8001`, đổi tên từ `api/`), xử lý OAuth Google, phiên, device/account; tin cậy identity header do gateway inject.

## 3. Tầng 2: Cây thư mục chi tiết theo module

### 3.1 Backend `sso/`
```text
sso/
├─ .prettierrc
├─ eslint.config.mjs
├─ nest-cli.json
├─ package.json
├─ pnpm-lock.yaml
├─ prisma/
│  └─ schema.prisma
├─ prisma.config.ts
├─ src/
│  ├─ app.module.ts
│  ├─ main.ts
│  ├─ auth/
│  │  ├─ auth.controller.ts
│  │  ├─ dto/
│  │  │  └─ exchange-google-code.dto.ts
│  │  ├─ auth.module.ts
│  │  ├─ auth.service.ts
│  │  ├─ token.service.ts
│  │  └─ auth.utils.ts
│  ├─ cache/
│  │  └─ redis-cache.module.ts
│  ├─ common/
│  │  ├─ constants/
│  │  │  └─ error-codes.constant.ts
│  │  ├─ exceptions/
│  │  │  └─ app.exception.ts
│  │  ├─ filters/
│  │  │  └─ http-exception.filter.ts
│  │  ├─ guards/
│  │  │  └─ google-auth.guard.ts
│  │  ├─ interfaces/
│  │  │  ├─ api-response.interface.ts
│  │  │  ├─ express-user.d.ts
│  │  │  └─ google-user.interface.ts
│  │  ├─ interceptors/
│  │  │  └─ response.interceptor.ts
│  │  ├─ pipes/
│  │  │  └─ parse-uuid.pipe.ts
│  │  └─ strategies/
│  │     └─ google.strategy.ts
│  ├─ database/
│  │  ├─ database.module.ts
│  │  └─ database.service.ts
├─ tsconfig.build.json
└─ tsconfig.json
```

Bảng mô tả chi tiết Backend:

| Đường dẫn | Loại | Vai trò |
|---|---|---|
| `sso/.prettierrc` | Cấu hình | Thiết lập format code cho backend. |
| `sso/eslint.config.mjs` | Cấu hình | Thiết lập luật lint cho backend. |
| `sso/nest-cli.json` | Cấu hình | Cấu hình Nest CLI cho build/generate. |
| `sso/package.json` | Metadata/Script | Khai báo script và dependency backend, gồm nhóm lệnh database với tiền tố `db:` (`db:generate`, `db:validate`, `db:migrate:*`, `db:push`, `db:pull`, `db:studio`). |
| `sso/pnpm-lock.yaml` | Lockfile | Khóa phiên bản dependency backend. |
| `sso/prisma/schema.prisma` | Cấu hình database | Định nghĩa schema Prisma cho PostgreSQL. |
| `sso/prisma.config.ts` | Cấu hình database | Cấu hình Prisma CLI và datasource URL từ môi trường. |
| `sso/src/main.ts` | Mã nguồn | Entry point khởi tạo ứng dụng NestJS, chạy HTTP server nội bộ ở `PORT=8001`. CORS/CSRF đã chuyển hết về API Gateway nên SSO không tự bật nữa. |
| `sso/src/app.module.ts` | Mã nguồn | Module gốc, đăng ký Config global với validate env bắt buộc (fail-fast khi thiếu biến) và import các module nghiệp vụ. |
| `sso/src/cache/redis-cache.module.ts` | Mã nguồn | Module tách riêng cấu hình Redis cache, đọc env bắt buộc qua ConfigService và đăng ký CacheModule global. |
| `sso/src/auth/auth.module.ts` | Mã nguồn | Module xác thực, gom controller/service/strategy cho OAuth Google và code-exchange flow qua cache manager. |
| `sso/src/auth/auth.controller.ts` | Mã nguồn | Endpoint khởi tạo Google OAuth, callback set cookie HttpOnly `google_change_token` theo `NODE_ENV` (`production` => `None+Secure`, dev => `Lax`) + redirect `/login/callback?code=...`, endpoint exchange trả access token + Google user và set cookie HttpOnly riêng `rt_<userId>`, đồng thời có `GET /auth/me` để FE lấy thông tin user hiện tại sau khi đổi account. |
| `sso/src/auth/dto/exchange-google-code.dto.ts` | Mã nguồn | DTO validate request body cho endpoint `POST /auth/google/exchange`. |
| `sso/src/auth/auth.utils.ts` | Mã nguồn | Utility nội bộ module `auth` để build URL redirect Google, khai báo hằng số cookie/tTL callback, và đọc giá trị cookie từ header. |
| `sso/src/auth/token.service.ts` | Mã nguồn | Service tách riêng trách nhiệm sinh one-time code, ký access/refresh token, và parse JWT change token của flow exchange. |
| `sso/src/auth/auth.service.ts` | Mã nguồn | Nghiệp vụ đồng bộ user Google, lưu one-time `code -> email` TTL 60s trong Redis, rồi exchange bằng đối soát code với email trong JWT cookie để cấp access/refresh token và trả Google user. |
| `sso/src/common/constants/error-codes.constant.ts` | Mã nguồn | Danh sách mã lỗi chuẩn dùng chung toàn backend. |
| `sso/src/common/exceptions/app.exception.ts` | Mã nguồn | Exception nghiệp vụ dùng object mã lỗi chuẩn và HTTP status tương ứng. |
| `sso/src/common/filters/http-exception.filter.ts` | Mã nguồn | Global filter map exception về format lỗi chuẩn của dự án. |
| `sso/src/common/guards/google-auth.guard.ts` | Mã nguồn | Guard bọc `AuthGuard('google')` để kích hoạt luồng OAuth Google. |
| `sso/src/common/interfaces/express-user.d.ts` | Khai báo kiểu | Mở rộng type `Express.User` dùng chung cho `req.user`. |
| `sso/src/common/interceptors/response.interceptor.ts` | Mã nguồn | Global interceptor chuẩn hóa success response. |
| `sso/src/common/loggers/app.logger.ts` | Mã nguồn | Custom logger dùng queue bất đồng bộ cho log output, vẫn in terminal và ghi thêm vào `sso/logs/YYYY-MM-DD.log`, đồng thời rút gọn log lỗi bootstrap/runtime. |
| `sso/src/common/pipes/parse-uuid.pipe.ts` | Mã nguồn | Pipe UUID dùng chung với format lỗi thống nhất. |
| `sso/src/common/strategies/google.strategy.ts` | Mã nguồn | Passport strategy xác thực Google OAuth 2.0 dùng chung. |
| `sso/src/common/utils/functions.ts` | Mã nguồn | File tập trung các hàm dùng chung backend, gồm hàm đọc cấu hình bắt buộc và helper xác định runtime production theo `NODE_ENV`. |
| `sso/src/common/utils/types.ts` | Mã nguồn | File tập trung các type dùng chung backend như error code, response envelope và Google user profile. |
| `sso/src/database/database.module.ts` | Mã nguồn | Module đóng gói và export service kết nối database. |
| `sso/src/database/database.service.ts` | Mã nguồn | Service Prisma dùng chung để các module khác inject. |
| `sso/tsconfig.json` | Cấu hình | Cấu hình TypeScript chính của backend. |
| `sso/tsconfig.build.json` | Cấu hình build | Cấu hình TypeScript cho quá trình build. |

### 3.2 API Gateway `api-gateway/`
```text
api-gateway/
├─ .env.example
├─ eslint.config.mjs
├─ nest-cli.json
├─ package.json
├─ pnpm-lock.yaml
├─ src/
│  ├─ app.module.ts
│  ├─ main.ts
│  ├─ auth/
│  │  ├─ auth-paths.ts
│  │  └─ gateway-auth.middleware.ts
│  ├─ proxy/
│  │  └─ proxy.middleware.ts
│  └─ session/
│     ├─ session.constants.ts
│     ├─ session-store.module.ts
│     └─ session-store.service.ts
├─ tsconfig.build.json
└─ tsconfig.json
```

Bảng mô tả chi tiết API Gateway:

| Đường dẫn | Loại | Vai trò |
|---|---|---|
| `api-gateway/.env.example` | Cấu hình | Mẫu biến môi trường gateway (`PORT=8000`, `SSO_URL`, `REDIS_*`, `CORS_ALLOWED_ORIGINS`, `COOKIE_DOMAIN`). |
| `api-gateway/src/main.ts` | Mã nguồn | Entry point khởi tạo gateway, lắng nghe cổng public `8000`. |
| `api-gateway/src/app.module.ts` | Mã nguồn | Module gốc, đăng ký Config global và mắc chuỗi middleware xác thực edge + proxy. |
| `api-gateway/src/auth/auth-paths.ts` | Mã nguồn | Khai báo danh sách route public (không bắt buộc session) để phân biệt với route protected. |
| `api-gateway/src/auth/gateway-auth.middleware.ts` | Mã nguồn | Middleware đọc cookie `session_id`, validate qua Redis, strip header `X-User-*` client gửi rồi inject identity tin cậy; route protected thiếu phiên hợp lệ trả 401. |
| `api-gateway/src/proxy/proxy.middleware.ts` | Mã nguồn | Proxy `/auth/*` và `/api/*` sang SSO (`SSO_URL`) bằng `http-proxy-middleware`. |
| `api-gateway/src/session/session-store.module.ts` | Mã nguồn | Module đóng gói và export service đọc session từ Redis. |
| `api-gateway/src/session/session-store.service.ts` | Mã nguồn | Service đọc `session:{sha256(token)}` từ Redis, sliding-renew TTL khi phiên còn hợp lệ. |
| `api-gateway/src/session/session.constants.ts` | Mã nguồn | Hằng số dùng chung cho session store (prefix key, tên cookie, header identity). |
| `api-gateway/tsconfig.json` | Cấu hình | Cấu hình TypeScript chính của gateway. |
| `api-gateway/tsconfig.build.json` | Cấu hình build | Cấu hình TypeScript cho quá trình build gateway. |

### 3.3 Frontend `ui/`
```text
ui/
├─ eslint.config.mjs
├─ next-env.d.ts
├─ next.config.ts
├─ package.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ postcss.config.mjs
├─ public/
│  ├─ file.svg
│  ├─ globe.svg
│  ├─ next.svg
│  ├─ vercel.svg
│  └─ window.svg
├─ src/
│  └─ app/
│     ├─ favicon.ico
│     ├─ globals.css
│     ├─ (private)/
│     │  ├─ home-page-client.tsx
│     │  ├─ layout.tsx
│     │  └─ page.tsx
│     ├─ (auth)/
│     │  ├─ layout.tsx
│     │  └─ login/
│     │     ├─ callback/
│     │     │  ├─ callback-client.tsx
│     │     │  └─ page.tsx
│     │     └─ page.tsx
│     └─ layout.tsx
├─ src/components/
│  └─ ui/
│     └─ button.tsx
├─ src/hooks/
│  └─ use-auth-hydration.ts
├─ src/lib/
│  ├─ api-client.ts
│  ├─ auth-callback.ts
│  └─ utils.ts
├─ src/providers/
│  └─ query-provider.tsx
├─ src/stores/
│  └─ auth-store.ts
└─ tsconfig.json
```

Bảng mô tả chi tiết Frontend:

| Đường dẫn | Loại | Vai trò |
|---|---|---|
| `ui/eslint.config.mjs` | Cấu hình | Thiết lập luật lint cho frontend. |
| `ui/next-env.d.ts` | Khai báo kiểu | File type declaration do Next.js quản lý. |
| `ui/next.config.ts` | Cấu hình | Cấu hình runtime/build cho Next.js. |
| `ui/package.json` | Metadata/Script | Khai báo script và dependency frontend. |
| `ui/pnpm-lock.yaml` | Lockfile | Khóa phiên bản dependency frontend. |
| `ui/pnpm-workspace.yaml` | Cấu hình workspace | Cấu hình workspace pnpm cho module UI. |
| `ui/postcss.config.mjs` | Cấu hình CSS pipeline | Cấu hình PostCSS và Tailwind. |
| `ui/public/file.svg` | Asset tĩnh | Biểu tượng tĩnh cho giao diện. |
| `ui/public/globe.svg` | Asset tĩnh | Biểu tượng tĩnh cho giao diện. |
| `ui/public/next.svg` | Asset tĩnh | Biểu tượng tĩnh cho giao diện. |
| `ui/public/vercel.svg` | Asset tĩnh | Biểu tượng tĩnh cho giao diện. |
| `ui/public/window.svg` | Asset tĩnh | Biểu tượng tĩnh cho giao diện. |
| `ui/src/app/layout.tsx` | Mã nguồn | Root layout của App Router. |
| `ui/src/app/(private)/layout.tsx` | Mã nguồn | Route group layout cho vùng private cần đăng nhập, giữ URL thật không đổi và bảo vệ route bằng trạng thái auth trong Zustand sau khi persist hydrate. |
| `ui/src/app/(private)/page.tsx` | Mã nguồn | Trang chính tại `/`, render home client component dưới Suspense. |
| `ui/src/app/(private)/home-page-client.tsx` | Mã nguồn | Client component chuyển account, gọi `GET /auth/me` theo account active và hiển thị thông tin user hiện tại. |
| `ui/src/app/(auth)/layout.tsx` | Mã nguồn | Route group layout cho vùng auth chỉ dành cho người chưa đăng nhập, giữ URL thật không đổi và redirect về `/` nếu đã có session. |
| `ui/src/app/(auth)/login/callback/page.tsx` | Mã nguồn | Route callback Google của FE, bọc client logic dưới Suspense. |
| `ui/src/app/(auth)/login/callback/callback-client.tsx` | Mã nguồn | Client component gọi BE đổi `code` với `withCredentials: true` để gửi cookie đổi mã, lưu token+user vào store và redirect về `/`. |
| `ui/src/app/(auth)/login/page.tsx` | Mã nguồn | Trang login Google trong auth route group, chuyển hướng sang BE `/auth/google` bằng axios baseURL. |
| `ui/src/app/globals.css` | Mã nguồn CSS | Khai báo style global của UI. |
| `ui/src/app/favicon.ico` | Asset giao diện | Favicon của ứng dụng. |
| `ui/src/components/ui/button.tsx` | Mã nguồn | Button UI dùng chung theo cấu hình shadcn hiện tại. |
| `ui/src/hooks/use-auth-hydration.ts` | Mã nguồn | Hook client kiểm tra Zustand persist đã hydrate xong trước khi redirect theo trạng thái auth. |
| `ui/src/lib/api-client.ts` | Mã nguồn | Axios instance dùng chung cho request UI -> BE; gắn access token của account active và chỉ refresh khi token hết hạn hoặc BE trả 401. |
| `ui/src/lib/auth-callback.ts` | Mã nguồn | Parse callback query `code` và validate response exchange token+user bằng Zod. |
| `ui/src/providers/query-provider.tsx` | Mã nguồn | QueryClientProvider toàn app cho React Query. |
| `ui/src/stores/auth-store.ts` | Mã nguồn | Zustand store persist user info + access token theo từng account trong localStorage, lưu `activeAccountId`, hỗ trợ switch account và logout. |
| `ui/tsconfig.json` | Cấu hình | Cấu hình TypeScript chính của frontend. |

### 3.4 Tài liệu `docs/`
```text
docs/
├─ business-overview-and-system-requirements-20260522.md
├─ database-design-20260522.md
├─ environment-configuration-reference-20260522.md
├─ general-conventions-20260522.md
├─ google-auth-redirect-api-20260523.md
├─ index.md
├─ project-error-codes-20260522.md
├─ project-structure-20260522.md
├─ security-20260522.md
├─ system-architecture-20260522.md
└─ technology-selection-20260522.md
```
