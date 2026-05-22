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
├─ src/
│  ├─ app.controller.spec.ts
│  ├─ app.controller.ts
│  ├─ app.module.ts
│  ├─ app.service.ts
│  └─ main.ts
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
| `api/package.json` | Metadata/Script | Khai báo script và dependency backend. |
| `api/pnpm-lock.yaml` | Lockfile | Khóa phiên bản dependency backend. |
| `api/src/main.ts` | Mã nguồn | Entry point khởi tạo và chạy ứng dụng NestJS. |
| `api/src/app.module.ts` | Mã nguồn | Module gốc, đăng ký controller và provider. |
| `api/src/app.controller.ts` | Mã nguồn | Định nghĩa endpoint HTTP. |
| `api/src/app.service.ts` | Mã nguồn | Chứa logic nghiệp vụ cho controller. |
| `api/src/*` (khu vực mở rộng) | Mã nguồn | Nơi tích hợp module cache Redis khi triển khai cache trong backend. |
| `api/src/app.controller.spec.ts` | Test | Unit test cho controller. |
| `api/test/app.e2e-spec.ts` | Test | E2E test cho backend API. |
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
| `ui/src/app/page.tsx` | Mã nguồn | Trang chủ mặc định của ứng dụng. |
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
├─ index.md
├─ project-error-codes-20260522.md
├─ project-structure-20260522.md
├─ security-20260522.md
├─ system-architecture-20260522.md
└─ technology-selection-20260522.md
```
