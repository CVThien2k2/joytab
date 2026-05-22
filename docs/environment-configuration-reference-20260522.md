# Tra cứu cấu hình môi trường

## 1. Mục tiêu tài liệu
- Tra cứu nhanh biến môi trường theo từng module và môi trường chạy.

## 2. Danh sách môi trường
- Local
- Development
- Staging
- Production

## 3. Bảng biến môi trường
| Biến | Module | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|---|
| `PORT` | api | Y | `3000` | Cổng chạy Service API. |
| `DATABASE_URL` | api | Y | - | Chuỗi kết nối PostgreSQL. |
| `REDIS_HOST` | api | Y | `127.0.0.1` | Host Redis server. |
| `REDIS_PORT` | api | Y | `6379` | Port Redis server. |
| `REDIS_PASSWORD` | api | N | - | Mật khẩu Redis nếu môi trường bật auth. |
| `REDIS_DB` | api | N | `0` | Chỉ số database trong Redis. |

## 4. Nhóm cấu hình theo chức năng
### 4.1 Ứng dụng
- <Danh sách biến>

### 4.2 Database
- `DATABASE_URL`

### 4.3 Cache/Queue
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `REDIS_DB`

### 4.4 Bảo mật
- <Danh sách biến nhạy cảm>

## 5. Quy trình cập nhật cấu hình
1. <Bước 1>
2. <Bước 2>
3. <Bước 3>

## 6. Lưu ý an toàn
- Không commit secret vào Git.
- Dùng file `.env.example` để mô tả biến bắt buộc.
