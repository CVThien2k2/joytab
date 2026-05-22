# Công nghệ lựa chọn

## 1. Mục tiêu tài liệu
- Ghi nhận stack công nghệ đang dùng và lý do lựa chọn.

## 2. Danh sách công nghệ theo lớp
| Lớp | Công nghệ | Phiên bản | Lý do chọn |
|---|---|---|---|
| Frontend | Next.js | 16.x | Hỗ trợ App Router tốt, DX cao, phù hợp SSR/SEO và phát triển UI hiện đại. |
| Backend | NestJS | 11.x | Kiến trúc module rõ ràng, phù hợp mô hình monolith có tổ chức lớp/layer. |
| Database | PostgreSQL | Theo môi trường triển khai | Quan hệ dữ liệu mạnh, ổn định, phù hợp nghiệp vụ transactional. |
| Cache | Redis | Theo môi trường triển khai | Tăng tốc truy xuất dữ liệu nóng, hỗ trợ cache/session/rate-limit hiệu quả. |

## 3. Tiêu chí đánh giá công nghệ
- Độ ổn định.
- Khả năng mở rộng.
- Mức độ phù hợp với team.
- Độ phức tạp bảo trì.
