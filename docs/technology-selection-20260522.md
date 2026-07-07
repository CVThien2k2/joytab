# Công nghệ lựa chọn

## 1. Mục tiêu tài liệu
- Ghi nhận stack công nghệ đang dùng (theo `package.json`) và lý do lựa chọn.

## 2. Nền tảng theo lớp
| Lớp | Công nghệ | Phiên bản | Lý do chọn |
|---|---|---|---|
| Frontend | Next.js (App Router) + React | Next `16.2`, React `19.2` | DX cao, App Router, phù hợp UI hiện đại. |
| Backend | NestJS | `11.x` | Kiến trúc module rõ ràng cho monolith có tổ chức layer. |
| ORM | Prisma (`@prisma/client` + adapter `pg`) | `7.x` | Type-safe, migration/generate tiện, adapter PostgreSQL. |
| Database | PostgreSQL | `16` (docker-compose) | Quan hệ dữ liệu mạnh, phù hợp transactional. |
| Cache | Redis | `7` (docker-compose) | Truy xuất nhanh, hỗ trợ cache/rate-limit. |
| Ngôn ngữ | TypeScript | - | Type-safe cả FE và BE. |
| Package manager | pnpm | - | Cài đặt nhanh, workspace. |

## 3. Thư viện chính Backend (`api/`)
| Thư viện | Vai trò |
|---|---|
| `@nestjs/config` | Load & validate biến môi trường (fail-fast). |
| `@nestjs/passport` + `passport-google-oauth20` | Xác thực Google OAuth 2.0. |
| `@nestjs/throttler` | Rate limit global và theo nhóm `/auth`. |
| `@nestjs/cache-manager` + `@keyv/redis` | Cache layer trên Redis. |
| `@prisma/client` + `@prisma/adapter-pg` + `pg` | Truy cập PostgreSQL. |
| `helmet` | Security headers. |
| `class-validator` + `class-transformer` | Validate/transform DTO. |
| `jsonwebtoken` | **Chưa sử dụng** (design intent; phiên hiện tại không dùng JWT). |

## 4. Thư viện chính Frontend (`ui/`)
| Thư viện | Vai trò |
|---|---|
| `@tanstack/react-query` | Data fetching/caching cho các call auth. |
| `axios` | HTTP client (gửi cookie `withCredentials`). |
| `zustand` | State auth in-memory toàn app. |
| `zod` + `@hookform/resolvers` + `react-hook-form` | Validate schema/response và form. |
| `radix-ui` + `shadcn` + `class-variance-authority` + `tailwind-merge` | Hệ thống UI component. |
| `next-themes` + `tw-animate-css` | Theme light/dark và animation. |
| `lucide-react` | Icon. |
| `sonner` | Toast notification. |
| `@fingerprintjs/fingerprintjs` | Dependency có sẵn, hiện chưa dùng trong `src`. |

## 5. Tiêu chí đánh giá công nghệ
- Độ ổn định.
- Khả năng mở rộng.
- Mức độ phù hợp với team.
- Độ phức tạp bảo trì.
