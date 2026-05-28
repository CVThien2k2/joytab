# Cấu trúc dự án

## 1. Mục tiêu tài liệu
- Chuẩn hóa cách tổ chức thư mục theo nhiều tầng.
- Giúp tra cứu nhanh từ tầng dự án -> module -> file.

## 2. Tầng 1: Cây thư mục tổng dự án
```text
project-root/
├─ api/
├─ ui/
├─ docs/
├─ .ai/
├─ .github/
├─ docker-compose.yml
├─ AGENTS.md
└─ zensical.toml
```

Thành phần hạ tầng ngoài source code:
- PostgreSQL: database chính của hệ thống.
- Redis: cache layer dùng cùng Service API.

## 3. Tầng 2: Cây thư mục chi tiết theo module

### 3.1 Backend `api/`
```text
api/
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
| `api/.prettierrc` | Cấu hình | Thiết lập format code cho backend. |
| `api/eslint.config.mjs` | Cấu hình | Thiết lập luật lint cho backend. |
| `api/nest-cli.json` | Cấu hình | Cấu hình Nest CLI cho build/generate. |
| `api/package.json` | Metadata/Script | Khai báo script và dependency backend, gồm nhóm lệnh database với tiền tố `db:` (`db:generate`, `db:validate`, `db:migrate:*`, `db:push`, `db:pull`, `db:studio`). |
| `api/pnpm-lock.yaml` | Lockfile | Khóa phiên bản dependency backend. |
| `api/prisma/schema.prisma` | Cấu hình database | Định nghĩa schema Prisma cho PostgreSQL. |
| `api/prisma.config.ts` | Cấu hình database | Cấu hình Prisma CLI và datasource URL từ môi trường. |
| `api/src/main.ts` | Mã nguồn | Entry point khởi tạo ứng dụng NestJS, bật CORS theo `FRONTEND_ORIGIN` với `credentials: true`, sau đó chạy HTTP server. |
| `api/src/app.module.ts` | Mã nguồn | Module gốc, đăng ký Config global với validate env bắt buộc (fail-fast khi thiếu biến) và import các module nghiệp vụ. |
| `api/src/cache/redis-cache.module.ts` | Mã nguồn | Module tách riêng cấu hình Redis cache, đọc env bắt buộc qua ConfigService và đăng ký CacheModule global. |
| `api/src/auth/auth.module.ts` | Mã nguồn | Module xác thực, gom controller/service/strategy cho OAuth Google và code-exchange flow qua cache manager. |
| `api/src/auth/auth.controller.ts` | Mã nguồn | Endpoint khởi tạo Google OAuth, callback set cookie HttpOnly `google_change_token` theo `NODE_ENV` (`production` => `None+Secure`, dev => `Lax`) + redirect `/login/callback?code=...`, và endpoint exchange trả access token + Google user, đồng thời set cookie HttpOnly `refresh_token`. |
| `api/src/auth/dto/exchange-google-code.dto.ts` | Mã nguồn | DTO validate request body cho endpoint `POST /auth/google/exchange`. |
| `api/src/auth/auth.utils.ts` | Mã nguồn | Utility nội bộ module `auth` để build URL redirect Google, khai báo hằng số cookie/tTL callback, và đọc giá trị cookie từ header. |
| `api/src/auth/token.service.ts` | Mã nguồn | Service tách riêng trách nhiệm sinh one-time code, ký access/refresh token, và parse JWT change token của flow exchange. |
| `api/src/auth/auth.service.ts` | Mã nguồn | Nghiệp vụ đồng bộ user Google, lưu one-time `code -> email` TTL 60s trong Redis, rồi exchange bằng đối soát code với email trong JWT cookie để cấp access/refresh token và trả Google user. |
| `api/src/common/constants/error-codes.constant.ts` | Mã nguồn | Danh sách mã lỗi chuẩn dùng chung toàn backend. |
| `api/src/common/exceptions/app.exception.ts` | Mã nguồn | Exception nghiệp vụ dùng object mã lỗi chuẩn và HTTP status tương ứng. |
| `api/src/common/filters/http-exception.filter.ts` | Mã nguồn | Global filter map exception về format lỗi chuẩn của dự án. |
| `api/src/common/guards/google-auth.guard.ts` | Mã nguồn | Guard bọc `AuthGuard('google')` để kích hoạt luồng OAuth Google. |
| `api/src/common/interfaces/express-user.d.ts` | Khai báo kiểu | Mở rộng type `Express.User` dùng chung cho `req.user`. |
| `api/src/common/interceptors/response.interceptor.ts` | Mã nguồn | Global interceptor chuẩn hóa success response. |
| `api/src/common/loggers/app.logger.ts` | Mã nguồn | Custom logger rút gọn log lỗi bootstrap/runtime, tránh in stack trace quá dài. |
| `api/src/common/pipes/parse-uuid.pipe.ts` | Mã nguồn | Pipe UUID dùng chung với format lỗi thống nhất. |
| `api/src/common/strategies/google.strategy.ts` | Mã nguồn | Passport strategy xác thực Google OAuth 2.0 dùng chung. |
| `api/src/common/utils/functions.ts` | Mã nguồn | File tập trung các hàm dùng chung backend, gồm hàm đọc cấu hình bắt buộc và helper xác định runtime production theo `NODE_ENV`. |
| `api/src/common/utils/types.ts` | Mã nguồn | File tập trung các type dùng chung backend như error code, response envelope và Google user profile. |
| `api/src/database/database.module.ts` | Mã nguồn | Module đóng gói và export service kết nối database. |
| `api/src/database/database.service.ts` | Mã nguồn | Service Prisma dùng chung để các module khác inject. |
| `api/tsconfig.json` | Cấu hình | Cấu hình TypeScript chính của backend. |
| `api/tsconfig.build.json` | Cấu hình build | Cấu hình TypeScript cho quá trình build. |

### 3.2 Frontend `ui/`
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
| `ui/src/app/(private)/home-page-client.tsx` | Mã nguồn | Client component hiển thị thông tin session đã lưu và nút đăng xuất, giữ nguyên giao diện dashboard hiện tại. |
| `ui/src/app/(auth)/layout.tsx` | Mã nguồn | Route group layout cho vùng auth chỉ dành cho người chưa đăng nhập, giữ URL thật không đổi và redirect về `/` nếu đã có session. |
| `ui/src/app/(auth)/login/callback/page.tsx` | Mã nguồn | Route callback Google của FE, bọc client logic dưới Suspense. |
| `ui/src/app/(auth)/login/callback/callback-client.tsx` | Mã nguồn | Client component gọi BE đổi `code` với `withCredentials: true` để gửi cookie đổi mã, lưu token+user vào store và redirect về `/`. |
| `ui/src/app/(auth)/login/page.tsx` | Mã nguồn | Trang login Google trong auth route group, chuyển hướng sang BE `/auth/google` bằng axios baseURL. |
| `ui/src/app/globals.css` | Mã nguồn CSS | Khai báo style global của UI. |
| `ui/src/app/favicon.ico` | Asset giao diện | Favicon của ứng dụng. |
| `ui/src/components/ui/button.tsx` | Mã nguồn | Button UI dùng chung theo cấu hình shadcn hiện tại. |
| `ui/src/hooks/use-auth-hydration.ts` | Mã nguồn | Hook client kiểm tra Zustand persist đã hydrate xong trước khi redirect theo trạng thái auth. |
| `ui/src/lib/api-client.ts` | Mã nguồn | Axios instance dùng chung cho request UI -> BE. |
| `ui/src/lib/auth-callback.ts` | Mã nguồn | Parse callback query `code` và validate response exchange token+user bằng Zod. |
| `ui/src/providers/query-provider.tsx` | Mã nguồn | QueryClientProvider toàn app cho React Query. |
| `ui/src/stores/auth-store.ts` | Mã nguồn | Zustand store persist session token+user cục bộ và hỗ trợ logout. |
| `ui/tsconfig.json` | Cấu hình | Cấu hình TypeScript chính của frontend. |

### 3.3 Tài liệu `docs/`
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
