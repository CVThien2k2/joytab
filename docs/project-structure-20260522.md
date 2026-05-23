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
│  │  ├─ auth.module.ts
│  │  ├─ auth.spec.ts
│  │  ├─ auth.service.ts
│  │  └─ auth.utils.ts
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
│  └─ database/
│     ├─ database.module.ts
│     ├─ database.service.spec.ts
│     └─ database.service.ts
├─ test/
│  ├─ app.e2e-spec.ts
│  └─ jest-e2e.json
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
| `api/src/main.ts` | Mã nguồn | Entry point khởi tạo và chạy ứng dụng NestJS. |
| `api/src/app.module.ts` | Mã nguồn | Module gốc, đăng ký các module/provider dùng chung. |
| `api/src/auth/auth.module.ts` | Mã nguồn | Module xác thực, gom controller/service/strategy cho OAuth Google. |
| `api/src/auth/auth.controller.ts` | Mã nguồn | Endpoint khởi tạo Google OAuth, callback đăng nhập, và redirect về FE khi thành công. |
| `api/src/auth/auth.spec.ts` | Test | File unit test duy nhất của module `auth`, bao gồm service/controller/utils. |
| `api/src/auth/auth.utils.ts` | Mã nguồn | Utility nội bộ module `auth` để chuẩn hóa redirectTo và build URL success. |
| `api/src/auth/auth.service.ts` | Mã nguồn | Nghiệp vụ đồng bộ user Google vào bảng `users`. |
| `api/src/common/constants/error-codes.constant.ts` | Mã nguồn | Danh sách mã lỗi chuẩn dùng chung toàn backend. |
| `api/src/common/exceptions/app.exception.ts` | Mã nguồn | Exception nghiệp vụ dùng object mã lỗi chuẩn và HTTP status tương ứng. |
| `api/src/common/filters/http-exception.filter.ts` | Mã nguồn | Global filter map exception về format lỗi chuẩn của dự án. |
| `api/src/common/guards/google-auth.guard.ts` | Mã nguồn | Guard bọc `AuthGuard('google')`, chuẩn hóa redirectTo và đính vào OAuth state trước khi chuyển hướng sang Google. |
| `api/src/common/interfaces/express-user.d.ts` | Khai báo kiểu | Mở rộng type `Express.User` dùng chung cho `req.user`. |
| `api/src/common/interceptors/response.interceptor.ts` | Mã nguồn | Global interceptor chuẩn hóa success response. |
| `api/src/common/loggers/app.logger.ts` | Mã nguồn | Custom logger rút gọn log lỗi bootstrap/runtime, tránh in stack trace quá dài. |
| `api/src/common/pipes/parse-uuid.pipe.ts` | Mã nguồn | Pipe UUID dùng chung với format lỗi thống nhất. |
| `api/src/common/strategies/google.strategy.ts` | Mã nguồn | Passport strategy xác thực Google OAuth 2.0 dùng chung. |
| `api/src/common/utils/functions.ts` | Mã nguồn | File tập trung các hàm dùng chung backend, hiện chứa hàm đọc cấu hình bắt buộc và throw `AppException` theo mã lỗi. |
| `api/src/common/utils/types.ts` | Mã nguồn | File tập trung các type dùng chung backend như error code, response envelope và Google user profile. |
| `api/src/database/database.module.ts` | Mã nguồn | Module đóng gói và export service kết nối database. |
| `api/src/database/database.service.ts` | Mã nguồn | Service Prisma dùng chung để các module khác inject. |
| `api/src/database/database.service.spec.ts` | Test | Unit test lifecycle kết nối/ngắt kết nối của Prisma service. |
| `api/test/app.e2e-spec.ts` | Test | E2E test kiểm tra bootstrap backend và route mặc định khi chưa khai báo API. |
| `api/test/jest-e2e.json` | Cấu hình test | Cấu hình Jest cho E2E test. |
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
│     ├─ layout.tsx
│     └─ page.tsx
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
| `ui/src/app/page.tsx` | Mã nguồn | Trang login Google, truyền redirectTo khi gọi endpoint `/auth/google`. |
| `ui/src/app/globals.css` | Mã nguồn CSS | Khai báo style global của UI. |
| `ui/src/app/favicon.ico` | Asset giao diện | Favicon của ứng dụng. |
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
